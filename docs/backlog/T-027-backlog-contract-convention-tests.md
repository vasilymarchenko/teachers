---
id: T-027
type: ticket
title: Convention tests for the backlog and document contract
status: todo
depends_on: [T-017]
refs:
  - docs/backlog/CLAUDE.md
  - docs/architecture/glossary.md
  - lib/auth/queryDiscipline.test.ts
  - docs/backlog/T-022-mutation-returning-convention-test.md
---

## Goal

Three checks that the `teachers-review-contract` agent performs by hand on every
ticket become tests in `npm test`, so the reviewer stops spending attention on
what a test can decide: the index against the frontmatter it mirrors, the `refs:`
of every backlog item, and the glossary against the code.

`/teachers-review` phase 6 exists to raise exactly this — "a check that has now
fired twice belongs in a lint rule or a convention test, not in a reviewer's
attention" — and may only propose. This is the ticket the proposal becomes, the
same shape as `T-022`.

## Acceptance criteria

- [ ] A test asserts the `README.md` tables against the item frontmatter they
      mirror: `id`, `title`, `status` and `depends_on`, in both directions —
      every item file has a row and every row has an item file.
      `docs/backlog/CLAUDE.md` states the rule it enforces:

      > Any edit to an item's `id`, `title`, `status` or `depends_on` obliges you
      > to update `README.md` in the same commit. […] A README row that disagrees
      > with the frontmatter it mirrors is a bug, not a stale detail.

- [ ] That test compares titles with markdown inline code normalised. The README
      writes `` `expand()` `` where the frontmatter writes `expand()`, in four
      rows today, and a naive comparison reports all four as defects — see the
      homework below.
- [ ] A test asserts that every path in every item's `refs:` exists, and that a
      `path §N` names a section that resolves in the target document.
- [ ] The `§N` notation is settled before that test ships.
      `docs/backlog/CLAUDE.md` defines `§N` as a section reference, and two
      items use `§12.1` for *item 1 of a numbered list under §12* of the
      specification, which is not a section and not a defined notation.
      Either the notation grows a definition or those two refs change; the test
      enforces whichever it becomes.
- [ ] A test asserts that each English identifier bound by
      `docs/architecture/glossary.md` appears in the code, and that a term with
      no code yet is marked as such in the glossary rather than being
      indistinguishable from one that has silently drifted.
- [ ] A test asserts the status-against-checkboxes invariant: a ticket that is
      `done` has every acceptance-criteria box ticked, and a ticket whose boxes
      are all ticked is `done`. `declined` is exempt, and so is a ticket with no
      criteria. It enforces what `/teachers-ticket` phase 7 states:

      > Tick a box **only where the evidence names a `file:line` or a test**;
      > anything else stays unticked with the reason, and the ticket stays
      > `in-progress`.

- [ ] That test admits the one shape a `done` ticket may legitimately carry an
      unticked box in: the box names a `T-NNN` that exists, carrying what is left
      — see the homework below. An unticked box in a `done` ticket that names no
      such ticket is the defect the check is for.
- [ ] Each test fails against a deliberately broken fixture — a README row edited
      away from its frontmatter, a `refs:` path that does not exist, a glossary
      identifier that appears nowhere — so a green run means the check ran rather
      than matched nothing (`T-022`, same criterion).
- [ ] Each test flags nothing in the repository once the three findings below are
      resolved, and the quoted rule sits in the test file so a later reader can
      tell the check from an opinion.
- [ ] All three run in `npm test`: source text and markdown only, no database and
      no network, like `lib/auth/queryDiscipline.test.ts`.

## Notes

Raised by an analysis of the ticket and review skills on 2026-09-09. Each of the
three checks is one the contract agent is told to perform by reading
(`.claude/agents/teachers-review-contract.md`), and the first is one both skills
run as a hand-comparison against a `grep` — `/teachers-ticket` phase 1 and the
agent's own "two checks worth running rather than reading".

**The homework, run against `main` at `9c37c40`.** Sketches of all three, per
`/teachers-review` phase 6: *"what it would flag in the repository today. Run
it. A rule that fails existing correct code is not ready."*

The `refs:` check reported three, all real:

```
Q-003  MISSING SECTION  docs/specs/specification.md §12.1
Q-005  MISSING SECTION  docs/specs/specification.md §12.2
T-017  MISSING PATH     .claude/skills/ticket/SKILL.md
```

`T-017`'s ref rotted when `T-020` renamed the skills to `teachers-*`; the file is
now `.claude/skills/teachers-ticket/SKILL.md`. The two `§12.N` refs are the
notation question above — specification §12 is a numbered list, so §12.1 and
§12.2 are list items, not sections. All three are left unfixed on purpose so
this ticket's implementation has something to verify the check against; fixing
them is part of the work.

The README check reported four, none real: `T-001`, `T-006`, `T-013` and `T-022`
differ from their frontmatter only by the backticks the README puts around an
identifier. That is the rule needing narrowing rather than the documents needing
fixing, hence the second criterion.

The glossary check reported two: `Student` and `StudentContact` are in the
glossary and in no code. Both are legitimately second-phase — `README.md`'s
*Coverage* records that the class list (§9) has no tickets by design — so the
check cannot be shipped as written. The glossary needs a way to say "named, not
yet built", and that is a change to the glossary, not only to a test.

The status-against-checkboxes check, run against `main` at `9797c76`, reported
one: `T-024` is `done` with one of fifteen boxes unticked. It is correct as it
stands — the box asks for branch protection on `main`, which is repository
configuration that no commit can contain, and its own text says so and names
`T-025` as carrying it. So the naive rule fails correct state, which is the
second criterion above: a `done` ticket may leave a box unticked when that box
names the ticket the remainder moved to. Narrowed that way the check passes the
repository today and still catches the case it exists for — a run interrupted
after the work but before phase 7, or a phase 7 that ticked the boxes and forgot
the `status`.

It does **not** catch a run that stopped before ticking anything: boxes unticked
and `status: in-progress` is a consistent state, and the check cannot know the
work was finished. Resuming such a run is `T-034`'s `--resume` and `T-035`.

**A fourth check was considered and rejected: the language rule.** Root
`CLAUDE.md` fixes language by audience, and a test for "no Ukrainian in the
developer-only trees" looks mechanical. It is not. A sketch over
`docs/backlog/**`, `docs/architecture/decisions/**`, `docs/architecture/design/**`
and `.claude/**` reported 38 violations, and every one inspected was correct
prose: a quoted Ukrainian requirement, a UI label under review, or teacher-facing
data — `Алгебра`, `7-А`, `Ковальчук М. І.` — which root `CLAUDE.md` allows
explicitly ("Ukrainian appears in either subtree only inside data a teacher would
read"). Narrowing by quote marks does not save it: the quotes wrap across lines,
appear as `«…»` and as `"…"`, and bare data appears with no quotes at all. There
is no mechanical way to separate Ukrainian data a teacher reads from Ukrainian
prose that should have been English, so the language rule stays a review
judgment. Recorded here so it is not proposed a third time.
