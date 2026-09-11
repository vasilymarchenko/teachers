---
id: T-033
type: ticket
title: Scope /teachers-review to the change under review, and make its effort level a parameter
status: done
depends_on: [T-017]
refs:
  - .claude/skills/teachers-review/SKILL.md
  - .claude/agents/teachers-review-contract.md
  - .claude/skills/teachers-ticket/SKILL.md
  - docs/architecture/decisions/ADR-001-review-reads-the-documents.md
  - docs/architecture/decisions/ADR-012-one-check-definition.md
  - docs/architecture/decisions/ADR-015-review-scoped-to-the-change.md
---

## Goal

`/teachers-review` runs one fixed breadth on every invocation — `/code-review
<target> high`, every pass, every self-review round — and reports findings from
files the diff does not touch. Give the skill a resolved scope, so a review
spends its budget on the change it was pointed at, and a resolved effort level,
so the caller chooses how much reading a review is worth. The level is
`/code-review`'s own argument: this skill borrows its vocabulary rather than
inventing a second one beside it.

## Acceptance criteria

- [x] `--effort low|medium|high|max` is resolved in phase 1 beside `--merge` and
      `--comment`, appears in the arguments table with its default in review mode
      and in self-review mode, and is stated in the same line that states the
      target and the ticket. The name and the four level names are
      `/code-review`'s, unchanged: one word means one thing in both skills.
- [x] The skill states what each level buys, in `/code-review`'s own terms — low
      and medium give fewer, high-confidence findings; high and max give broader
      coverage and may include uncertain ones — and attributes that sentence to
      `/code-review` as its source, so a change there is detectable here rather
      than silently contradicted.
- [x] One table in the skill maps `--effort` to what runs: the level passed
      through to `/code-review`, how far phase 2's reading extends, and whether
      phase 6 runs. No level is named anywhere else in the file.
- [x] The frontmatter `description` of `teachers-review` names `--effort` and its
      levels beside `--merge` and `--comment`, which it already names, so a
      caller reading the skill list sees what the argument does without opening
      the file. `teachers-ticket`'s description does the same for the arguments
      it takes.
- [x] `--effort` defaults to `high` in review mode, leaving a deliberate
      standalone review as broad as it is today. What each self-review round
      gets is `T-034`'s to set.
- [x] `/code-review` is invoked with the target phase 1 resolved **and** a scope
      restricted to the paths the diff touches.
- [x] A finding whose `file:line` lies outside the diff is not reported as a
      finding of this review and owes the caller no disposition. A security or
      data-correctness defect among them is named in a separate
      `## Outside this change` section of the report instead.
- [x] Phase 2 reads the documents governing the paths the diff touches, and the
      skill states how that set is derived from the diff rather than listing it.
- [x] Phase 6 runs at `--effort max` only.
- [x] Phase 3 establishes the **mechanical verdict** on the target rather than
      always producing one. The skill states one rule by target: on a pull
      request, read what `ci.yml` reported on the head under review, which
      `ADR-007` makes the authoritative gate and which runs the checks this
      machine reports as `skipped`; in self-review, the `.gate/ledger.jsonl` row
      for that head; on a branch or a working tree, run `npm run gate`, because
      nothing else has. The local gate still runs wherever no verdict on this
      exact head exists, is pending, or cannot be read.
- [x] What the guarantee `T-017` found the hard way turns on is stated as the
      head and tree the verdict was produced against, not as which command
      produced it: a verdict from a different head or a dirty tree is not
      evidence, whether it came from CI, the ledger or a local run. Where the
      verdict cannot be established at all, the report says so — never that it
      passed.
- [x] The self-review default level is stated in exactly one of
      `teachers-review` and `teachers-ticket`; the other references it.
- [x] The skill still carries no architectural rule and no check list
      (`ADR-001`, `ADR-012`).
- [x] An ADR records the scoping decision, the effort parameter and the verdict
      rule, the alternatives rejected, and what a narrowed review no longer
      catches. It names `ADR-001`'s revisit condition as the one being exercised
      — narrowing *which* documents are read for a given diff by routing better —
      and states that no document content is cached into the tooling, which that
      ADR rules out.

## Notes

The scoping decision, the `--effort` parameter and the phase 3 verdict rule are
recorded in `docs/architecture/decisions/ADR-015-review-scoped-to-the-change.md`.

The self-review level is stated in `.claude/skills/teachers-ticket/SKILL.md`
phase 7, and stays at today's value here: `T-034` is what lowers it, along with
the rest of the loop it rewrites.

Criterion 3's "No level is named anywhere else in the file" cannot hold
literally beside criteria 2 and 4, which require a level in the buys sentence and
in the frontmatter `description`. It is implemented as the rule those three
criteria together describe: a level appears in the argument row, the buys
sentence and the effort table — all adjacent — and in the frontmatter, and **no
phase below the table names one**, so no phase can contradict it. The skill
states those places rather than claiming the table is the only one.

Criterion 7 is written as a location test — a finding whose `file:line` lies
outside the diff. It is implemented as a **causation** test, which the location
of a line answers in nearly every case but not in one: a file this change
obliged to update and did not — a `README.md` row against the frontmatter it
mirrors, the glossary against a term the change introduces. That defect sits
outside the diff and this change caused it, and a location test would drop
exactly the findings `.claude/agents/teachers-review-contract.md` exists to
produce, which `docs/backlog/CLAUDE.md` calls "a bug, not a stale detail". The
criterion's purpose — that a round is not spent on code nobody touched — is
unaffected.

Criterion 10 names self-review as a case of the verdict rule. It is implemented
as a **precedence**: CI's verdict on the head, then the ledger row for it, then
a local run. Self-review is not a fourth target but the second row's usual case,
because the caller has just pushed and CI has not finished. Stated as a mode it
would let a ledger row outrank a finished CI run on the same head, and `ADR-007`
makes that run the authoritative gate.

Evidence: the efficiency analysis of session `4c401314` (the `/teachers-ticket
T-021` run). Round 3 of that run's review loop cost 31.6% of the session and
returned no finding inside the pull request — three of its five findings were in
`scripts/gate/**`, already merged on `main` and untouched by the diff, and the
`/code-review` fork for that round alone was 9.46M tokens, roughly double the
two rounds before it. The measured baseline is committed by `T-034` as
`docs/architecture/design/T-034-context-cost-baseline.md`.

Document-consistency drift — 11 of that run's 18 findings — is `T-027`'s
subject, not this ticket's.

Phase 7 ran two full review rounds. Round 1 produced thirteen findings and round
2 five more, most of them defects round 1's own fixes had introduced; all
eighteen are disposed as `fixed` in `.gate/findings.json`, with the `file:line`
each was fixed at. Round 3 was stopped by the user before either pass reported,
so the round-2 fixes — the `.gate/last-run.json` verdict rule, the closed phase 1
escape hatch, the `ci.yml`-only merge precondition, and the corrections to
`ADR-015` — carry no second reading. The criteria resting on those fixes are
3, 7 and 10, whose implemented readings are recorded above.
