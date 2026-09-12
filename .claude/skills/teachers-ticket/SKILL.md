---
name: teachers-ticket
description: Take a backlog ticket from docs/backlog, plan it, implement it on a fresh branch, open a well-described PR, then re-review that PR against the ticket, the architecture documents and the repository conventions and push the fixes. Use when the user invokes /teachers-ticket (optionally with a ticket id such as /teachers-ticket T-005, --resume, which picks an interrupted run up from its state file alone and carries no context from the session that wrote it, and --persist-plan or --no-persist-plan, which force where phase 4's plan lives and override every trigger), or asks to "take the next ticket", "work the backlog", "implement T-NNN", or "pick up the next item from docs/backlog".
---

# Work a backlog ticket

End to end: pick the ticket, understand it, plan it, build it, ship a PR, then
review your own PR and fix what the review finds. Seven phases, in order. Do not
skip ahead — in particular, no code is written before the plan is approved, and
no PR is called finished before phase 7 has run.

The repository's own rules win over anything below. Read the root `CLAUDE.md`
(layout, language rules, the `new Date()` and `userId` rules) and
`docs/backlog/CLAUDE.md` (backlog conventions) before phase 3.

The standard phase 7 measures against is the repository's documents themselves,
read at review time — `/teachers-review` holds the method, not a copy of the rules
(`docs/architecture/decisions/ADR-001-review-reads-the-documents.md`). This file
does not restate them either.

## The run state file

A run writes `.gate/run.json` **at every phase boundary**, and **every phase's
first instruction is to read it**. It is the run's memory outside the
conversation: a session that is compacted, interrupted or replaced picks the run
up from this file, and a phase never re-derives what an earlier phase already
established.

```json
{
  "ticket": "T-034",
  "ticketPath": "docs/backlog/T-034-bound-the-ticket-loop-context.md",
  "branch": "claude/ticket-t-034-bound-the-loop",
  "pr": 32,
  "phase": 5,
  "flags": { "persistPlan": false, "effort": "medium" },
  "plan": ["one line per file the plan adds or changes, and what it does"],
  "criteria": [{ "id": 1, "work": "scripts/cost/transcript-cost.ts", "state": "done" }],
  "filesTouched": ["CLAUDE.md", ".claude/skills/teachers-ticket/SKILL.md"],
  "remaining": ["what this phase has not finished"],
  "designDoc": "docs/architecture/design/T-034-….md",
  "updatedAt": "2026-09-12T09:14:00.000Z"
}
```

`.gate/` is git-ignored, so the file never reaches a diff, and it sits beside
the two records the loop already reads — `.gate/ledger.jsonl` and
`.gate/findings.json` (`scripts/gate/ledger.ts` owns those paths).

**The plan is condensed into it, not copied.** One line per file and one row per
acceptance criterion is what a later phase needs; the argument for the plan
belongs in the conversation and in the pull request body.

**Write it before the phase ends, not after the next one starts.** A phase that
finished work the file does not record is work the resumed run will do twice.

**`--resume` picks a run up from that file alone.** It reads `.gate/run.json`,
checks out the branch named there, states the ticket, the pull request and the
phase it is resuming at in one line, and continues from that phase — carrying no
context from the session that wrote the file, and asking the user for none. If
the file is missing, or names a branch that does not exist, say so and stop:
a run that cannot be resumed is not a run to start over silently.

## Phase 1 — Choose the ticket

**`--resume` skips this phase.** With that flag the run has already been chosen:
read `.gate/run.json`, check out the branch it names, and continue at the phase
it records. Everything below is about choosing a ticket the session does not
have yet.

If the invocation carries an id (`/teachers-ticket T-005`), that is the ticket. The
invocation may also carry `--persist-plan` or `--no-persist-plan`, which decide
phase 4's output; note the flag and carry it forward.

Otherwise take the **first ticket in `docs/backlog/README.md` table order whose
`status` is `todo`** — the table is ordered by priority, the id number is not.
Verify against the authoritative frontmatter, not the table.

**Read the frontmatter from `origin/main`, not from disk.** This is the one
phase that runs before a branch is cut, so the files in the working tree are
whatever the last checkout left there — possibly a finished ticket still marked
`todo`, and a run started on work someone already did. The root `CLAUDE.md`
states the discipline; here is the sweep it applies to:

```sh
for f in $(git ls-tree --name-only origin/main docs/backlog/ | grep -E '/[TQ]-.*\.md$'); do
  printf '%s: ' "$f"; git show "origin/main:$f" | grep -E '^(id|title|status|depends_on):' | tr '\n' ' '; echo
done
```

The same holds for `docs/backlog/README.md`, whose table order decides which
ticket is first. It is only *selection* that reads `origin/main`: once the run
has a ticket and phase 2 has cut its branch, every read is from the working tree
that checkout populated — including the ticket file itself, which is where this
run's own status change is being written.

If the table and a frontmatter disagree, the frontmatter is right; fix the table
in your first commit and say so.

Then check the gate before starting:

- Every id in `depends_on` must be `done` (tickets) or `answered` (questions).
  If one is not, skip to the next `todo` ticket and tell the user why.
- `status: blocked` is never picked automatically. Neither is a ticket whose
  `depends_on` names an `open` question.
- If the user named a ticket that is blocked or has unmet dependencies, say what
  is unmet and ask whether to proceed anyway (`AskUserQuestion`) rather than
  quietly starting.

State the chosen ticket — id, title, why this one — in one line before moving on,
and write `.gate/run.json` with the ticket, its path, the flags in force and
`phase: 1` — the branch is still empty at this point and phase 2 fills it in.

## Phase 2 — Cut the branch, then understand the ticket

Read `.gate/run.json` first — phase 1 wrote the ticket and the branch into it.

**Cut the branch first**, before reading anything but the ticket's own id:

```sh
git checkout -b claude/ticket-t-NNN-<short-slug> origin/main
```

(If the session was handed a designated branch, use that name instead — never
push to a different branch than the one you were given.)

No fetch here: `origin/main` is the ref the session's `SessionStart` hook
fetched, and the checkout fills the working tree from it. That is the point of
cutting the branch now rather than in phase 5 — everything read below comes from
a tree that is current, and the only window in which this run can read a stale
file is phase 1's frontmatter sweep, which reads `origin/main` directly for
exactly that reason. A branch cut for a ticket the user declines in phase 3 is
deleted (`git checkout main && git branch -D <branch>`), which is cheaper than a
plan built against stale code.

Then read, in this order:

1. The ticket file: `## Goal`, every acceptance criterion, `## Notes`.
2. Every path in `refs:`. `path §N` means section N of that document — read that
   section and enough around it to see the reasoning. A ticket deliberately does
   not restate the architecture, so the `refs` are not optional background.
3. `docs/architecture/glossary.md` for every domain term the ticket uses. Code
   uses the English identifier the glossary binds; a term that is not in the
   glossary does not exist yet.
4. The code the ticket touches, plus one neighbouring module already written in
   the target style, so the new code reads like its surroundings.
5. Any `Q-NNN` the ticket's `refs` or acceptance criteria point at — an open
   question usually has a *current default* that the code must implement, in one
   named place.

Write the branch and `phase: 2` into `.gate/run.json` before moving on.

## Phase 3 — Ask before assuming

Read `.gate/run.json` first.

Ask the user — with `AskUserQuestion`, options first, one round if possible —
when:

- an acceptance criterion can be read two ways and the readings produce
  materially different code;
- the ticket requires a product decision that neither the specification nor the
  architecture document settles (a UI wording, a rule about a teacher's day);
- the work would need a schema change, a new dependency, or a change to
  `architect-overview.md`;
- an open question the ticket depends on has no recorded default to code against.

Do not ask what the documents already answer, and do not ask for permission to
follow the conventions. Do everything that does not depend on the answer while
you wait, and batch the questions into one round rather than trickling them.

Record the answers in `.gate/run.json` — an answer the user gave once is not a
question a resumed run may ask again — and set `phase: 3`.

## Phase 4 — Plan first

Read `.gate/run.json` first.

Produce a written implementation plan **before any edit**. For a ticket that
touches more than two or three files, delegate the exploration to the `Plan`
subagent — give it the ticket text, the `refs` sections and the two `CLAUDE.md`
files, and ask for the file-by-file plan; then take its output and check it
yourself against the acceptance criteria. For a small, obvious ticket, write the
plan directly.

The plan must state:

- **Files** to add or change, each with one line on what it does.
- **Acceptance criteria → work item** — a mapping, so an untouched criterion is
  visible before implementation rather than after.
- **Tests**: which suites, which cases, and which fixture document they come
  from. Expectations must be derived from the fixtures or the specification,
  **never obtained by running the code first**.
- **Documentation impact**: which of `architect-overview.md`, `glossary.md`,
  `docs/architecture/design/**` change, whether the work carries a decision that
  earns an ADR (phase 5), and the backlog status update.
- **Risks and trade-offs**, including anything the plan deliberately leaves out.

Present the plan and get the user's approval before implementing. Then condense
it into `.gate/run.json` — one line per file, one row per acceptance criterion,
the design document's path if the plan is persisted — and set `phase: 4`. That
condensation is what phases 5 to 7 read; the argument for the plan stays in the
conversation and in the pull request body.

### Where the plan lives

**Ephemeral by default.** The plan lives in the conversation and, condensed, in
the PR body. Most tickets need nothing more, and a plan file per ticket would
rot against the code it describes.

**Persist it when the invocation says so or a trigger fires.** The user can force
either way with a flag: `/teachers-ticket T-005 --persist-plan` or `--no-persist-plan`
(the flag always wins, in both directions, and no trigger overrides it). With no
flag, *offer* to persist — one `AskUserQuestion`, defaulting to yes — when any
of these holds:

- the ticket itself asks for a design document (as `T-001` and `T-003` did);
- the plan changes the database schema, a migration, or a contract other tickets
  are written against;
- the plan pins a decision on an open `Q-NNN` that later work will have to find;
- the plan carries hand-derived expected values — fixtures, worked examples —
  that the tests must be checkable against and that no one should recompute;
- the work is large enough to span sessions, so the next agent needs the plan
  rather than this conversation.

Volume of files alone is not a trigger. What earns a file is a fact that outlives
the ticket.

**How to persist.** `docs/architecture/design/T-NNN-<short-slug>.md`, English (the
`design/` subtree is the exception to the Ukrainian architecture rule — root
`CLAUDE.md`). Follow the header the existing documents in that directory use:

```markdown
# <Title>

**Ticket:** `docs/backlog/T-NNN-....md`
**Status:** authoritative for T-NNN.

Rationale lives in `docs/architecture/architect-overview.md` §N. This document
adds no reasoning: it states <mechanics: signatures, columns, order, expected
values>.
```

That last sentence is the contract. A persisted plan states mechanics and never
re-argues the overview — reference the section instead. Reference it from the
ticket's `## Notes` and from the PR body, commit it with the implementation, and
keep it reconciled in phase 7: after the review, either update the document to
what was actually built or change its `**Status:**` line to say what superseded
it. A plan file that contradicts the merged code is worse than no plan file.

## Phase 5 — Implement

Read `.gate/run.json` first.

On the branch phase 2 cut — one branch per ticket, and nothing here fetches or
branches again.

While implementing, hold the rules that are easy to break silently. They are
stated once, in the documents phase 2 put in front of you — the root
`CLAUDE.md`, the conventions file of each directory you write into, and the
architecture sections in the ticket's `refs:`. Phase 7 will check the code
against those same documents, not against a list kept in this file.

**Write an ADR when the trigger fires.** A decision that changes the data model
or a contract other tickets are written against, that chooses between real
alternatives whose cost outlives the ticket, that would otherwise have to be
reverse-engineered from the code, or that reverses an earlier decision, goes
into `docs/architecture/decisions/` as `ADR-NNN`, committed with the work that
implements it. `architect-overview.md` then states the outcome and links to the
ADR rather than re-arguing it, and the ticket's `## Notes` names it. Conventions
and the template: `docs/architecture/decisions/README.md`. Not every ticket
produces one — see the trigger list there before writing.

Update the backlog in the same commit as the work it describes: the ticket's
frontmatter `status` and the mirrored row in `docs/backlog/README.md`. **Leave
the checkboxes under `## Acceptance criteria` alone** — phase 7 ticks them, once
the gate is green and each one has evidence. Ticking them here means ticking them
before a single check has run. Set `done` only in phase 7 and only when every
criterion is actually ticked; until then `in-progress`, with `## Notes` saying
what remains. A
decision that changes the design belongs in `architect-overview.md` with a
reference from `## Notes`, not buried in the ticket.

Commit message: `T-NNN: <what changed>`, English, imperative, body explaining the
non-obvious choices.

Update `.gate/run.json` as you go — the files touched, the criteria now covered,
what remains — and set `phase: 5` before phase 6 starts. A criterion finished
but not recorded is a criterion the resumed run implements twice.

## Phase 6 — Verify, then open the PR

Read `.gate/run.json` first.

Everything must pass before the PR exists, and one command says whether it does:

```sh
npm run gate
```

It resolves what the branch adds to `origin/main` plus the uncommitted change,
selects the checks that change needs, runs **all** of them without
short-circuiting, prints one table and exits non-zero if any failed. Do not
assemble a chain of check commands of your own: joined so that the first failure
hides the rest, it turns one report into three round-trips, and it drifts out of
step with `ci.yml` the moment either changes. Which checks exist is
`scripts/gate/checks.ts`, held level with the workflow by
`scripts/gate/checks.ci.test.ts` (`ADR-012`), and nothing about them belongs in
this file.

**Gate a tree that has not been gated.** Read `.gate/last-run.json` before
running it: if its `commit` is the current `HEAD` and the tree is clean now
(`git status --porcelain` is empty), that table already describes this tree and
the gate does not run again — read the table from the file instead. The same
holds in phase 7, where the loop gates after each fix. A second run over an
unchanged tree measures nothing and spends a `gateRunsPerRound` count.

A check the gate does not run comes back `skipped` with the reason — because
this machine cannot run it (no Docker daemon, no `DATABASE_URL`), or because
the kind of change routed it away and `ci.yml` runs it on the pushed commit
instead (`ADR-016`). **A skip is never a pass**, and the reason column is what
tells the two apart. Carry every one of them into the PR body with its reason;
`npm run gate -- --pr-block` prints the block to paste.

Push with `git push -u origin <branch>`, then open the PR. Check for a PR
template first (`.github/pull_request_template.md`,
`.github/PULL_REQUEST_TEMPLATE.md`, root, `docs/`) and populate its headings if
one exists. Otherwise write the body as:

- **Ticket** — `T-NNN`, title, link to the ticket file.
- **What changed** — the shape of the change, file groups, not a file list.
- **Acceptance criteria** — each one, with the file or test that satisfies it;
  anything not yet satisfied, with the reason. The boxes in the ticket file
  itself are still unticked at this point — phase 7 ticks them.
- **Decisions** — choices a reviewer would otherwise have to reverse-engineer,
  and the alternatives rejected.
- **Tests** — the gate's table, including every skipped check and its reason.
- **Follow-ups** — deliberately out of scope; a new ticket id if one was added.

Title: `T-NNN: <ticket title>`. English, like everything else developer-facing.

Write the pull request number and `phase: 6` into `.gate/run.json`. Phase 7 and
every subagent it launches read the number from there, not from the
conversation.

## Phase 7 — The bounded fix loop, with the ticket bound

Read `.gate/run.json` first.

This phase is a **loop**, not a step, and it is not a re-read of your own diff
from memory. The loop is not written here: it is `/teachers-fix-loop`, one unit
with one written contract, and this phase is a call into it (`ADR-014`,
`ADR-017`). Everything the loop owns — the caps in `scripts/gate/caps.ts`, the
four dispositions, the rule that a count comes from a record the agent did not
author, the round's subagent boundary, the exit criterion — is stated there and
in no second place, this file included.

**The call:**

```
/teachers-fix-loop --state .gate/run.json --pr <n> --ticket docs/backlog/T-NNN-….md --effort medium
```

**`--effort medium`, on every round, and this line is the one place the level a
self-review round gets is stated.** The names are `/code-review`'s own
vocabulary, which `/teachers-review` carries unchanged; that skill takes what it
is given and states no self-review value of its own, so the one word is not
written in two files that can disagree. `medium` is the level because a round's
breadth is no longer what keeps it honest — the review is scoped to the diff
(`ADR-015`) and the loop stops at the first round with no finding inside it.
Raise it by hand for a round that needs wider reading, and know that the round
costs what you raised it to.

**What comes back** is the loop's return value: the exit reason, the rounds, what
is still undisposed, the `## Outside this change` items and what the gate and CI
said. Take it as it stands. Do not re-run a round to check it, and do not
re-read the diff to form a second opinion — the second opinion is what the round
was bought to avoid.

### What only the ticket makes possible — this phase's own work

The loop does none of this, because a caller with no ticket has none of it to do.
After it returns:

- **Tick the acceptance criteria**, in the ticket file, and mirror the `status`
  in `docs/backlog/README.md`. Tick a box **only where the evidence names a
  `file:line` or a test**; anything else stays unticked with the reason, and the
  ticket stays `in-progress`. They are ticked here, after the checks have run —
  not in phase 5, where nothing had been checked yet. `status: done` only when
  every box is ticked.
- **Reconcile a persisted plan**, if phase 4 wrote one: update the document to
  what was actually built, or change its `**Status:**` line to say what
  superseded it.
- **Carry the loop's `deferred` ticket ids** into the pull request body's
  follow-ups, and its `## Outside this change` items into the final report.

### Before the ticket may be called done

- **The gate is green on the tree that was pushed.** Read
  `.gate/last-run.json` — the loop gated after its last fix, and a tree that has
  not changed since does not get gated again. Every check it skipped is named as
  skipped, with its reason, in the pull request body. A skip is not a pass.
- **CI on the pushed head is the last gate.** `ci.yml` is the authoritative one
  (`ADR-007`); it checks the commit you actually pushed, on a machine that has
  the Docker daemon and the database this one may not. The ticket is not done
  while that run is red or pending. Read it with `gh pr checks` — **never with
  a `sleep`**; `gh pr checks <n> --watch --interval 30` blocks inside `gh`
  instead of holding the context open. Where `gh` cannot read it — not
  installed, not authenticated, no pull request — say exactly that. **Never that
  it passed.**
- **`npm run gate -- --report`** answers the whole question in one exit code: it
  runs no check, reads the counts and what CI said, and refuses — naming which
  cap, or what CI reported. It refuses a *conclusion*, never a measurement.
- **Write `.gate/run.json` one last time**, with the exit reason and what is
  still open, before reporting.

Report back with the pull request link, what the loop changed, what is still
open, and every check that did not run here.

## Definition of done

- The right ticket was chosen and its dependencies were satisfied.
- The plan was approved before implementation, and — if it was persisted —
  the document under `docs/architecture/design/` matches what was built.
- Branch, commits and PR follow the naming and language conventions.
- Backlog frontmatter, checkboxes and `README.md` agree with each other and with
  the work.
- `npm run gate` is green on the pushed head, and every check it did not run —
  whether this machine could not, or the kind of change routed it away — is
  reported as skipped, with its reason, rather than as a pass.
- `/teachers-fix-loop` returned `converged` or a named cap, each round is in
  `.gate/findings.json` with every finding disposed, and the PR body reflects
  the final state.
- `.gate/run.json` was written at every phase boundary, and the run could have
  been resumed from it at any of them.
- The acceptance criteria were ticked in phase 7, against evidence, and `status`
  is `done` only if all of them are.
- `gh pr checks` on the pushed head is green, or the report says plainly that it
  could not be read.
