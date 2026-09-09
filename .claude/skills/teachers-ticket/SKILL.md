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
does not restate them either. What changed in T-026 is not the standard but what
happens to the *result* of measuring against it: it is recorded rather than
remembered.

**A phase is passed when a row says so.** `npm run gate` writes one row per
check to `.gate/ledger.jsonl` — name, result, exit code, the commit it ran
against, and when — and phase 7 writes its rounds and dispositions to
`.gate/findings.json`. Neither file is committed; `.gate/` is gitignored, and a
reviewer reads the summary in the pull request body instead (ADR-011). **If this
session was resumed and has no memory of a phase, read those two files rather
than re-attesting from the conversation** — `npm run gate -- --report` renders
both — and carry on from what they say.

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
frontmatter `status` — `in-progress` — and the mirrored row in
`docs/backlog/README.md`. A decision that changes the design belongs in
`architect-overview.md` with a reference from `## Notes`, not buried in the
ticket.

**Leave the acceptance-criteria checkboxes unticked.** They are ticked in phase
7, after the gate is green and against evidence — a criterion ticked here is
ticked before a single check has run, which is a claim rather than a record.

Commit message: `T-NNN: <what changed>`, English, imperative, body explaining the
non-obvious choices.

## Phase 6 — Gate, then open the PR

```sh
npm run gate
```

One command, and the only one. It resolves `git diff --name-only origin/main...HEAD`
plus whatever is uncommitted, selects the checks that diff needs, runs **all** of
them without stopping at the first failure, prints one table and writes a row per
check to `.gate/ledger.jsonl`. What it selects is held in step with `ci.yml` by
`scripts/gate/checks.test.ts`, so a green gate is CI's answer and not a subset of
it — ADR-011.

Do not run the checks by hand instead. A hand-assembled `&&` chain is how
`npm run build` and `scripts/verify-schema.sql` came to be in CI and not in this
phase, so a pull request could be verified locally and red in CI.

A check the gate could not run is recorded as `skipped` with the reason and is
**never** reported as passed — repeat the reason in the PR body. `--only`,
`--all` and `--base` are there for narrowing while you work; the run that
precedes the PR is the plain one.

If a check is red, fix it and run the gate again. If it is red once and you
suspect the environment rather than the code, `npm run gate -- --rerun <check>`
is the single re-run you get: green makes it a flake, which is recorded as one
and owes a backlog ticket; red again is a finding. A third attempt is refused.

Push with `git push -u origin <branch>`, then open the PR. Check for a PR
template first (`.github/pull_request_template.md`,
`.github/PULL_REQUEST_TEMPLATE.md`, root, `docs/`) and populate its headings if
one exists. Otherwise write the body as:

- **Ticket** — `T-NNN`, title, link to the ticket file.
- **What changed** — the shape of the change, file groups, not a file list.
- **Acceptance criteria** — each one, checked, with the file or test that
  satisfies it; anything left unchecked, with the reason.
- **Decisions** — choices a reviewer would otherwise have to reverse-engineer,
  and the alternatives rejected.
- **Tests** — what runs, and the commands' results.
- **Follow-ups** — deliberately out of scope; a new ticket id if one was added.

Title: `T-NNN: <ticket title>`. English, like everything else developer-facing.

## Phase 7 — The review loop

Not a pass. A loop, with a stated exit criterion and stated caps:

> **review → triage → fix → gate → re-review, ending when no finding in the
> latest round is left undisposed.**

It already ran twice before it said so: T-012 shipped two review-fix commits,
`918f4a3` and `7632913`, where this file described one pass, and the second
round found a repetition that had outlived its form and an ADR the calendar had
outgrown — neither of which the first round saw. A phase that runs twice on the
day and once on paper has no exit criterion, and its caps are whatever the
session had patience for.

### The caps

- **At most three review rounds.**
- **At most three fix attempts per failing check.**

Both are counted from `.gate/ledger.jsonl`, not from memory, and
`npm run gate -- --report` names the one that was reached. **Hitting a cap stops
the loop.** Report the ledger and everything still open to the user; do not open
another round, and do not report the ticket done.

### One round

**1. Review.**

```sh
/teachers-review <pr> --self-review T-NNN
```

That flag selects self-review defaults — no merge, no inline comments, and no
questions about anything this ticket already answers. It checks the target out,
reads the documents that govern the code you changed, runs its own gate against
that checkout, runs the `teachers-review-contract` agent and `/code-review`, and
returns ranked findings. The standard is those documents, not a checklist — so a
rule you added to the architecture in this very ticket is one the review applies
to it.

**2. Record the round** in `.gate/findings.json`, before fixing anything:

```json
{
  "ticket": "T-NNN",
  "rounds": [
    {
      "round": 1,
      "at": "2026-09-09T12:00:00.000Z",
      "commit": "abc1234",
      "findings": [
        {
          "id": "R1-1",
          "file": "lib/domain/schedule/expand.ts:42",
          "rule": "architect-overview.md §8.5 — no new Date() in domain code",
          "summary": "expand() reads the clock instead of taking today",
          "source": "contract"
        }
      ]
    }
  ]
}
```

Countable is the point. Round *N* and round *N+1* are two lists, so convergence
is computed rather than asserted; prose findings cannot be diffed, and a loop
that cannot tell whether it converged has no exit criterion.

**3. Triage.** Every finding takes exactly one of four dispositions, written
back into its entry with the evidence that disposition costs:

| Disposition | Evidence field | What it means |
|---|---|---|
| `fixed` | `evidence` | the commit or `file:line` that fixes it |
| `rejected` | `refutation` | **the document text that refutes the rule the reviewer quoted** |
| `deferred` | `ticket` | a `T-NNN` that now exists in `docs/backlog/` |
| `accepted` | `acceptedNote` | the user was asked and accepted the cost |

`rejected` is the one this phase used to have no way to record. `/teachers-review`'s
evidence bar exists to kill wrong findings — *"if the document does not actually
say what you thought it said, the finding dies there"* — so a reviewer being
wrong is an outcome of the method working, and it has to be recordable as one.
It is refuted by quoting the document, never by disagreeing with the reviewer.

`deferred` means the ticket exists: write it, add it to `docs/backlog/README.md`,
and name it under *Follow-ups* in the PR body. A deferral to a ticket nobody
filed is a finding that was dropped.

**4. Fix**, in the same branch, as a separate commit (`T-NNN review fixes: <what>`).

**5. Gate.** `npm run gate`. A fix that breaks a check is a finding against the
fix, and the ledger is what says so.

**6. Re-review**, and start the next round — unless the exit criterion is met.

### Ticking the acceptance criteria

After the gate is green, and only then. Tick a criterion when an evidence row
names the `file:line` or the test that satisfies it; leave it unticked, with the
reason, when nothing does. Then set the ticket's `status` — `done` only when
every criterion is actually ticked, otherwise `in-progress` with `## Notes`
saying what remains — and update the mirrored row in `docs/backlog/README.md`.

If the plan was persisted, reconcile the document against what was built in the
same commit: updated, or its `**Status:**` line marked superseded and by what.

### Diff hygiene

`npm run gate` runs the mechanical half — no `.only`, no newly added `.skip`, no
`.env`, and the block `next dev` re-adds to `CLAUDE.md` committed with the work
rather than left as a stray change. The half no script can check is yours:
**every changed file appears in the approved plan's file list, or is explained in
the report.** There is no machine-readable plan to compare against, so nothing
checks this but you.

### CI green on the pushed head is the last gate

```sh
gh pr checks <pr> --watch
```

`ci.yml` is the authoritative gate (ADR-007), and a local gate is a prediction of
it. **Do not report the ticket done while that run is red or pending.** Where
`gh` is unavailable, the report says the run could not be read — never that it
passed.

### The report

```sh
npm run gate -- --report
```

Derived from the ledger and the findings file: what ran, against which commit,
what each round found, how each finding was disposed of, and what is still open.
Report *that*, plus the PR link and the CI result — not a summary of the
conversation. The two disagree exactly when the conversation is wrong, and a
session resumed after compaction reads the file and continues rather than
re-attesting.

## Definition of done

- The right ticket was chosen and its dependencies were satisfied.
- The plan was approved before implementation, and — if it was persisted —
  the document under `docs/architecture/design/` matches what was built.
- Branch, commits and PR follow the naming and language conventions.
- Backlog frontmatter, checkboxes and `README.md` agree with each other and with
  the work.
- `npm run gate` is green on the pushed head, and every check it could not run
  is named with its reason in the PR body.
- The acceptance-criteria checkboxes were ticked in phase 7, against evidence.
- The review loop converged inside its caps, or a cap was reported as reached;
  every finding carries one of the four dispositions and its evidence.
- `gh pr checks` reports the CI run on the pushed head green, or the report says
  it could not be read.
- The final report was derived from `.gate/ledger.jsonl`, not from the
  conversation.
