---
id: T-041
type: ticket
title: Year setup shows the teacher the next step, and says when the rest of the app is open
status: todo
depends_on: [T-038]
refs:
  - docs/specs/specification.md §3
  - docs/specs/specification.md §8
  - docs/architecture/architect-overview.md §8.6
---

## Goal

Make the gated `/year` screen lead a new teacher through the four setup items
to the open app. Today the gate itself is correct, but the screen gives no
path: saving one item leaves the teacher where they were with no hint of what
comes next, and the save that completes setup changes nothing they can see.

## Acceptance criteria

- [ ] Each item of the setup checklist that is still missing is a link to the
      section of the page where it is entered. Following it brings that section
      into view.
- [ ] After a save on `/year` while setup is still incomplete, the teacher
      sees, without scrolling, which item is next and can reach it in one click.
      Saving the year's dates is the case that must not dead-end: the
      checklist still lists the semesters and the bell schedule as missing.
- [ ] The save that completes setup — whichever of the four it is — tells the
      teacher, in Ukrainian and in view of the button they pressed, that setup
      is complete and the rest of the app is open, and offers the next step as
      a prominent action rather than the link at the bottom of the page.
      Where that action leads (the weekly template or the calendar) is
      decided in the plan and stated in `architect-overview.md` §8.6.
- [ ] On a narrow screen, where the navigation panel is collapsed, the same
      notice and action are shown; the teacher does not have to open the menu
      to find out the app is open.
- [ ] Once setup is complete and the notice has been acted on or the page is
      opened again, `/year` is the ordinary year setup screen — no checklist,
      no completion notice.
- [ ] The behaviour of the gate itself does not change: the four conditions,
      `getSetupStatus()`, `requireCompleteSetup()` and the redirect stay as
      T-038 left them.
- [ ] A browser-level test walks a teacher with no rows through all four
      items in the order the page presents them and asserts, after each save,
      what the teacher sees: the next missing item, and finally the completion
      notice with the full navigation.

## Notes

Found on the deployed app with a new teacher account, 2026-10-01: the teacher
saved the year's dates and found no way forward — the same screen, no new menu
items.

Reproduced locally with `npm run create-teacher`, against both `next dev` and
the production build, with Playwright. The gate works as T-038 specified:

- after the year form is saved the checklist turns two of four items green and
  the menu correctly stays at «Навчальний рік», because the semesters and the
  bell schedule are still missing. The checklist is plain text, the semester
  form is below the two year forms, and the bell schedule is near the end of a
  page about three screens long — nothing on screen says what to do next;
- after the fourth item is saved, the full menu does appear without a reload
  (`revalidatePath(YEAR_SETUP_PATH)` from a Server Action re-renders the
  `(app)` layout too), but the checklist disappears at the top of the page, out
  of view, and the only way on is «Перейти до календаря» at the very bottom.
  On a narrow screen the new menu items are behind the collapsed menu.

So the defect is the screen's flow, not the gate's logic or a stale layout.
