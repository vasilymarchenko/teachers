---
id: T-014
type: ticket
title: Application shell — navigation, layout and visual style
status: done
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

- [x] App Router layout with the route groups from overview §2:
      `(calendar)`, `(schedule)`, `(events)`, `(auth)`, `print`.
- [x] Dark left navigation panel, light work area, calm green-and-beige palette,
      large headings, per specification §8.
- [x] Theme values live in the Tailwind config and shadcn/ui tokens, not in
      per-component classes — specification §8 requires the style to be
      replaceable without reworking the app.
- [x] Navigation collapses to a usable form at 390 px.
- [x] Menu items "Календарне планування" and "Розробка уроку" are absent
      (specification §8, out of the first release).
- [x] `print` routes render outside this layout.
- [x] All UI text in Ukrainian.

## Notes

The shell layout lives in an `(app)` route group that wraps `(calendar)`,
`(schedule)` and `(events)`; `(auth)` and `print` are its siblings. The decision
and its reasoning are recorded where they belong —
`architect-overview.md` §2, whose tree was updated in this ticket.

The palette is provisional. The mockups §8 refers to were not available, so the
hues were chosen to its description (calm green and beige, dark panel). Every
value is a CSS variable in `app/globals.css`, so replacing them is a one-file
change. The single place outside it that names a colour is the print layout's
black on white, which §7 requires of paper and which a restyle must not touch.

The navigation is defined once, in `components/navigation/nav-items.ts`.
`nav-items.test.ts` checks each item against the routes that actually exist, so
a menu entry cannot outlive or precede its screen, and it fails if either
excluded item comes back.

The four screens behind the menu are placeholders naming the ticket that fills
them: T-007 (calendar), T-010 (schedule), T-009 (year), T-012 (events).
