---
id: T-013
type: ticket
title: Print mechanism — the /print route and its page layout
status: todo
depends_on: [T-007]
refs:
  - docs/architecture/architect-overview.md §6
  - docs/specs/specification.md §7
---

## Goal

Build the printing mechanism specification §7 requires in the first release: a
`/print/...` route rendering the same `ResolvedDay[]` + `Event[]` in a
print-specific layout, with the browser's "Save as PDF" as the output path.

## Acceptance criteria

- [ ] `/print/...` route with no navigation chrome, black and white.
- [ ] `@media print` rules with explicit page-break control; a week of lessons
      does not split mid-day across sheets.
- [ ] The first report — the weekly schedule — implemented as one page over the
      existing domain functions, with no logic copied out of the calendar.
- [ ] Adding a further report is one page file; documented as such in the
      route's README section so Q-003 can be answered later without redesign.
- [ ] Print output verified on A4 portrait and landscape in Chromium.
- [ ] All printed text in Ukrainian.

## Notes

Q-003 settles *which* reports are needed, not whether the mechanism exists;
overview §10.3 states each report is an isolated page over data that already
exists. This ticket is therefore not blocked on it.
