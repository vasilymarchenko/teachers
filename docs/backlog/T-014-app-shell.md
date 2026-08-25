---
id: T-014
type: ticket
title: Application shell — navigation, layout and visual style
status: todo
depends_on: [T-002]
refs:
  - docs/architecture/architect-overview.md §2
  - docs/specs/specification.md §8
---

## Goal

Build the frame every screen lands in: the dark left navigation panel, the light
work area and the shared Tailwind theme, so feature tickets add pages rather
than inventing chrome.

## Acceptance criteria

- [ ] App Router layout with the route groups from overview §2:
      `(calendar)`, `(schedule)`, `(events)`, `(auth)`, `print`.
- [ ] Dark left navigation panel, light work area, calm green-and-beige palette,
      large headings, per specification §8.
- [ ] Theme values live in the Tailwind config and shadcn/ui tokens, not in
      per-component classes — specification §8 requires the style to be
      replaceable without reworking the app.
- [ ] Navigation collapses to a usable form at 390 px.
- [ ] Menu items "Календарне планування" and "Розробка уроку" are absent
      (specification §8, out of the first release).
- [ ] `print` routes render outside this layout.
- [ ] All UI text in Ukrainian.

## Notes
