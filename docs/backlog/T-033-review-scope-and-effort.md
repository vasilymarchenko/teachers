---
id: T-033
type: ticket
title: Scope /teachers-review to the change under review, and make its effort level a parameter
status: in-progress
depends_on: [T-017]
refs:
  - .claude/skills/teachers-review/SKILL.md
  - .claude/agents/teachers-review-contract.md
  - .claude/skills/teachers-ticket/SKILL.md
  - docs/architecture/decisions/ADR-001-review-reads-the-documents.md
  - docs/architecture/decisions/ADR-012-one-check-definition.md
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

- [ ] `--effort low|medium|high|max` is resolved in phase 1 beside `--merge` and
      `--comment`, appears in the arguments table with its default in review mode
      and in self-review mode, and is stated in the same line that states the
      target and the ticket. The name and the four level names are
      `/code-review`'s, unchanged: one word means one thing in both skills.
- [ ] The skill states what each level buys, in `/code-review`'s own terms — low
      and medium give fewer, high-confidence findings; high and max give broader
      coverage and may include uncertain ones — and attributes that sentence to
      `/code-review` as its source, so a change there is detectable here rather
      than silently contradicted.
- [ ] One table in the skill maps `--effort` to what runs: the level passed
      through to `/code-review`, how far phase 2's reading extends, and whether
      phase 6 runs. No level is named anywhere else in the file.
- [ ] The frontmatter `description` of `teachers-review` names `--effort` and its
      levels beside `--merge` and `--comment`, which it already names, so a
      caller reading the skill list sees what the argument does without opening
      the file. `teachers-ticket`'s description does the same for the arguments
      it takes.
- [ ] `--effort` defaults to `high` in review mode, leaving a deliberate
      standalone review as broad as it is today. What each self-review round
      gets is `T-034`'s to set.
- [ ] `/code-review` is invoked with the target phase 1 resolved **and** a scope
      restricted to the paths the diff touches.
- [ ] A finding whose `file:line` lies outside the diff is not reported as a
      finding of this review and owes the caller no disposition. A security or
      data-correctness defect among them is named in a separate
      `## Outside this change` section of the report instead.
- [ ] Phase 2 reads the documents governing the paths the diff touches, and the
      skill states how that set is derived from the diff rather than listing it.
- [ ] Phase 6 runs at `--effort max` only.
- [ ] Phase 3 establishes the **mechanical verdict** on the target rather than
      always producing one. The skill states one rule by target: on a pull
      request, read what `ci.yml` reported on the head under review, which
      `ADR-007` makes the authoritative gate and which runs the checks this
      machine reports as `skipped`; in self-review, the `.gate/ledger.jsonl` row
      for that head; on a branch or a working tree, run `npm run gate`, because
      nothing else has. The local gate still runs wherever no verdict on this
      exact head exists, is pending, or cannot be read.
- [ ] What the guarantee `T-017` found the hard way turns on is stated as the
      head and tree the verdict was produced against, not as which command
      produced it: a verdict from a different head or a dirty tree is not
      evidence, whether it came from CI, the ledger or a local run. Where the
      verdict cannot be established at all, the report says so — never that it
      passed.
- [ ] The self-review default level is stated in exactly one of
      `teachers-review` and `teachers-ticket`; the other references it.
- [ ] The skill still carries no architectural rule and no check list
      (`ADR-001`, `ADR-012`).
- [ ] An ADR records the scoping decision, the effort parameter and the verdict
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

Evidence: the efficiency analysis of session `4c401314` (the `/teachers-ticket
T-021` run). Round 3 of that run's review loop cost 31.6% of the session and
returned no finding inside the pull request — three of its five findings were in
`scripts/gate/**`, already merged on `main` and untouched by the diff, and the
`/code-review` fork for that round alone was 9.46M tokens, roughly double the
two rounds before it. The measured baseline is committed by `T-034` as
`docs/architecture/design/T-034-context-cost-baseline.md`.

Document-consistency drift — 11 of that run's 18 findings — is `T-027`'s
subject, not this ticket's.
