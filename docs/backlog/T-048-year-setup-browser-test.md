---
id: T-048
type: ticket
title: Browser test for the first year setup, run in a new e2e job of ci.yml
status: todo
depends_on: [T-041]
refs:
  - docs/architecture/design/T-041-year-setup-way-out.md §4
  - docs/architecture/architect-overview.md §8.6
  - docs/architecture/decisions/ADR-012-one-check-definition.md
  - docs/architecture/decisions/ADR-013-row-reflows-against-its-container.md
  - docs/architecture/decisions/ADR-016-route-by-kind-of-change.md
---

## Goal

Measure in a real browser what T-041 could only check as rendered markup: a
teacher with no rows saves the year, the semesters and the bell schedule on
`/year`, and after each save sees what the design document's walk says. The
test is the project's first browser test, so it also lands the dependency, the
seeded database it renders from, and the check that runs it locally and in CI.

## Acceptance criteria

- [ ] A browser-level test walks a teacher with no rows through the three
      saves — the year with its initial parity, both semesters, the bell
      schedule — in the order the page presents them, and asserts after each
      save what the teacher sees: the next missing item, and finally the
      completion notice with the full navigation — the screens of
      `design/T-041-year-setup-way-out.md` §4, at desktop and at phone width.
- [ ] It runs against a production build and a migrated Postgres, and creates
      and removes its own teacher; it leaves no rows behind.
- [ ] `ci.yml` runs it in a new `e2e` gate job with its own Postgres service,
      and `publish` waits on that job too.
- [ ] `npm run gate` runs it through the one check definition
      (`scripts/gate/checks.ts`, held level by `scripts/gate/checks.ci.test.ts`
      — `ADR-012`), and reports it `skipped`, with the reason, on a machine
      with no database or no browser installed.
- [ ] Its browser-test dependency and the seeded database it renders from —
      the costs `ADR-013` recorded when it deferred a browser test — are
      recorded in an ADR and in `docs/tech-stack.md`.

## Notes

Split out of T-041 before that ticket was implemented (2026-10-04): the two
criteria above that name a browser test and its gate were T-041's last two, and
the choice of a separate `e2e` job was made then.

Filed as T-046 in #50, an id already held by `T-046-template-row-clear-icon.md`;
renumbered to T-048 in #51. Where #50 and its commits name T-046 for the
browser test, they mean this ticket.
