---
name: teachers-ticket
description: Take a backlog ticket from docs/backlog, plan it, implement it on a fresh branch, open a well-described PR, then re-review that PR against the ticket, the architecture documents and the repository conventions and push the fixes. Use when the user invokes /teachers-ticket (optionally with a ticket id such as /teachers-ticket T-005), or asks to "take the next ticket", "work the backlog", "implement T-NNN", or "pick up the next item from docs/backlog".
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

## Phase 1 — Choose the ticket

If the invocation carries an id (`/teachers-ticket T-005`), that is the ticket. The
invocation may also carry `--persist-plan` or `--no-persist-plan`, which decide
phase 4's output; note the flag and carry it forward.

Otherwise take the **first ticket in `docs/backlog/README.md` table order whose
`status` is `todo`** — the table is ordered by priority, the id number is not.
Verify against the authoritative frontmatter, not the table:

```sh
grep -H -E '^(id|title|status|depends_on):' docs/backlog/[TQ]-*.md
```

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

State the chosen ticket — id, title, why this one — in one line before moving on.

## Phase 2 — Understand it

Read, in this order:

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

## Phase 3 — Ask before assuming

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

## Phase 4 — Plan first

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

Present the plan and get the user's approval before implementing.

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

## Phase 5 — Implement on a new branch

Branch from the up-to-date default branch, one branch per ticket:

```sh
git fetch origin main && git checkout -b claude/ticket-t-NNN-<short-slug> origin/main
```

(If the session was handed a designated branch, use that name instead — never
push to a different branch than the one you were given.)

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

## Phase 6 — Verify, then open the PR

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

A check that cannot run here — no Docker daemon, no `DATABASE_URL` — comes back
`skipped` with the reason. **A skip is never a pass.** Carry every one of them
into the PR body with its reason; `npm run gate -- --pr-block` prints the block
to paste.

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

## Phase 7 — Review, fix and re-review, until nothing is left undisposed

This phase is a **loop**, not a step, and it is not a re-read of your own diff
from memory:

```
review → triage → fix → gate → re-review
```

**It ends when the latest round leaves no finding undisposed** — every finding
that round produced carries one of the four dispositions below — or when a cap
stops it. Nothing else ends it: not a round that felt thorough, and not a report
you have already drafted.

### The three caps

All three are **three**, and they live in one module — `scripts/gate/caps.ts` —
because a number restated in a skill file drifts out of step with the one the
gate counts against:

| Cap | Bounds |
|---|---|
| `reviewRounds` | review passes over the pull request |
| `gateRunsPerRound` | `npm run gate` invocations inside one round |
| `pushesAfterOpening` | pushes after the one that opened the pull request |

The second and third are the loops that are easy to leave open: a red check
fixed and re-gated inside a round, and a red CI run fixed and re-pushed after
it. `npm run gate` prints all three counts on every run, so a cap being
approached is visible in the terminal without anyone opening a file for it.

**Each count is derived from a record you did not write.** The gate runs in this
round are the distinct run ids the gate itself appended to `.gate/ledger.jsonl`
since the round's timestamp; the pushes come from the branch's own history. Only
the round number is yours, in `.gate/findings.json`. **A count held in the
conversation is not a count** — that is the one thing a compacted context is
guaranteed to take. Read them; never recall them.

**Re-running the gate against an unchanged tree, hoping for a different answer,
is not one of those attempts. It is not permitted.** The gate will still run it
and still count it — nothing here refuses a *measurement*, because the check is
what tells the truth and an environment fix changes no file. If the tree has not
changed, either the answer has not either, or what changed is the environment,
and that is worth saying out loud rather than re-rolling.

**Hitting any cap stops the loop.** Report what is still open — which findings,
which check, which count ran out — rather than opening a fourth of anything.
Three rounds that did not converge is information; a fourth rarely adds any.

### One round

1. **Review.**

   ```sh
   /teachers-review <pr> --self-review T-NNN
   ```

   That flag selects self-review defaults — no merge, no inline comments, and no
   questions to the user about anything this ticket already answers. It fetches
   the diff, reads the documents that govern the code you changed, runs the
   `teachers-review-contract` agent and `/code-review`, and returns ranked
   findings. The standard is those documents, not a checklist — so a rule you
   added to the architecture in this very ticket is one the review applies to it.

2. **Record the round in `.gate/findings.json` before fixing anything**, so
   round *N* and round *N+1* are two lists that can be compared:

   ```json
   {
     "rounds": [
       {
         "round": 1,
         "startedAt": "2026-09-10T11:04:00.000Z",
         "head": "9f2c1ab",
         "findings": [
           {
             "id": "R1-1",
             "location": "lib/db/queries/events.ts:42",
             "rule": "userId is the first argument of every function in lib/db/queries — CLAUDE.md, Code layout",
             "summary": "listEvents takes the range first, so a caller can omit the tenant filter.",
             "pass": "contract",
             "disposition": "fixed",
             "note": "commit 4d1e0aa"
           }
         ]
       }
     ]
   }
   ```

   `startedAt` and `head` are what the counts are measured from. **No code
   validates this file.** A validator can check that a field is not empty, never
   that it is true — a disposition recorded `fixed` against code that does not
   exist passes any validator anyone could write. What makes the file worth
   keeping is that the next round reads it, and that a resumed session can.

3. **Dispose of every finding.** Four dispositions, and each costs something:

   | Disposition | What it takes | What it costs |
   |---|---|---|
   | `fixed` | a commit that changes the named `file:line` | the fix has to survive the gate |
   | `rejected` | the document text that refutes the quoted rule, quoted back | having actually read the document, and being right |
   | `deferred` | a `T-NNN` that **exists** — file it, mirror it in `README.md` | the backlog carries it, and someone must do it |
   | `accepted` | the user said so, in this conversation | a question spent out of the user's attention |

   Nothing else is a disposition. "Noted", "will keep an eye on it" and silence
   are how a finding reaches `main`.

4. **Fix, then gate.** Apply the fixes on the same branch as one commit —
   `T-NNN review fixes: <what>` — then `npm run gate`. Every failing check is in
   one table: fix them together rather than one round-trip each.

5. **Push, then re-review.** A round that leaves nothing undisposed is the exit.

### Before the ticket may be called done

- **`npm run gate` is green**, and every check it skipped is named as skipped,
  with its reason, in the PR body. A skip is not a pass.
- **Tick the acceptance criteria now**, in the ticket file, and mirror the
  `status` in `docs/backlog/README.md`. Tick a box **only where the evidence
  names a `file:line` or a test**; anything else stays unticked with the reason,
  and the ticket stays `in-progress`. They are ticked here, after the checks have
  run — not in phase 5, where nothing had been checked yet.
- **`gh pr checks` on the pushed head is the last gate.** `ci.yml` is the
  authoritative one (`ADR-007`) and it checks the commit you actually pushed, on
  a machine that has the Docker daemon and the database this one may not. The
  ticket is not done while that run is red or pending. Where `gh` cannot read
  it — not installed, not authenticated, no PR — say exactly that. **Never that
  it passed.**
- **`npm run gate -- --report`** answers the whole question in one exit code: it
  runs no check, reads the counts and what CI said, and refuses — naming which
  cap, or what CI reported. It refuses a *conclusion*, never a measurement.
- If the plan was persisted, reconcile the document against what was actually
  built: updated, or its `**Status:**` line marked superseded and by what.

Report back with the PR link, what the review changed, what is still open, and
every check that did not run here.

## Definition of done

- The right ticket was chosen and its dependencies were satisfied.
- The plan was approved before implementation, and — if it was persisted —
  the document under `docs/architecture/design/` matches what was built.
- Branch, commits and PR follow the naming and language conventions.
- Backlog frontmatter, checkboxes and `README.md` agree with each other and with
  the work.
- `npm run gate` is green on the pushed head, and every check it could not run
  is reported as skipped, with its reason, rather than as a pass.
- Phase 7 looped to its exit criterion or to a cap, each round is in
  `.gate/findings.json` with every finding disposed, and the PR body reflects
  the final state.
- The acceptance criteria were ticked in phase 7, against evidence, and `status`
  is `done` only if all of them are.
- `gh pr checks` on the pushed head is green, or the report says plainly that it
  could not be read.
