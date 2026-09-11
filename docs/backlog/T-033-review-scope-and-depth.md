---
id: T-033
type: ticket
title: Scope /teachers-review to the change under review, and make its depth a parameter
status: todo
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
spends its budget on the change it was pointed at, and a resolved depth, so the
caller chooses how much reading a review is worth.

## Acceptance criteria

- [ ] `--depth low|standard|deep` is resolved in phase 1 beside `--merge` and
      `--comment`, appears in the arguments table with its default in review mode
      and in self-review mode, and is stated in the same line that states the
      target and the ticket.
- [ ] One table in the skill maps `--depth` to what runs: the `/code-review`
      effort level, how far phase 2's reading extends, and whether phase 6 runs.
      No effort level is named anywhere else in the file.
- [ ] `/code-review` is invoked with the target phase 1 resolved **and** a scope
      restricted to the paths the diff touches.
- [ ] A finding whose `file:line` lies outside the diff is not reported as a
      finding of this review and owes the caller no disposition. A security or
      data-correctness defect among them is named in a separate
      `## Outside this change` section of the report instead.
- [ ] Phase 2 reads the documents governing the paths the diff touches, and the
      skill states how that set is derived from the diff rather than listing it.
- [ ] Phase 6 runs at `--depth deep` only.
- [ ] In self-review mode the skill reuses a gate run recorded in
      `.gate/ledger.jsonl` when that run's head and tree match the checked-out
      target, and names the reused run in the report; any difference in either
      re-runs the gate. The guarantee `T-017` found the hard way — a gate that
      ran against a different tree is not evidence — still holds.
- [ ] The self-review default depth is stated in exactly one of
      `teachers-review` and `teachers-ticket`; the other references it.
- [ ] The skill still carries no architectural rule and no check list
      (`ADR-001`, `ADR-012`).
- [ ] An ADR records the scoping decision and the depth parameter, the
      alternatives rejected, and what a narrowed review no longer catches.

## Notes

Evidence: the efficiency analysis of session `4c401314` (the `/teachers-ticket
T-021` run). Round 3 of that run's review loop cost 31.6% of the session and
returned no finding inside the pull request — three of its five findings were in
`scripts/gate/**`, already merged on `main` and untouched by the diff, and the
`/code-review` fork for that round alone was 9.46M tokens, roughly double the
two rounds before it. The measured baseline is committed by `T-034` as
`docs/architecture/design/T-034-context-cost-baseline.md`.

Document-consistency drift — 11 of that run's 18 findings — is `T-027`'s
subject, not this ticket's.
