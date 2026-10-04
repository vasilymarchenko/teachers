---
id: T-041
type: ticket
title: Year setup shows the teacher the next step, and says when the rest of the app is open
status: done
depends_on: [T-038]
refs:
  - docs/specs/specification.md §3
  - docs/specs/specification.md §8
  - docs/architecture/architect-overview.md §8.6
  - docs/architecture/design/T-041-year-setup-way-out.md
---

## Goal

Make the gated `/year` screen lead a new teacher through the four setup items
to the open app. Today the gate itself is correct, but the screen gives no
path: saving one item leaves the teacher where they were with no hint of what
comes next, and the save that completes setup changes nothing they can see.

## Acceptance criteria

- [x] Each item of the setup checklist that is still missing is a link to the
      section of the page where it is entered. Following it brings that section
      into view.
- [x] After a save on `/year` while setup is still incomplete, the teacher
      sees, without scrolling, which item is next and can reach it in one click.
      Saving the year's dates is the case that must not dead-end: the
      checklist still lists the semesters and the bell schedule as missing.
- [x] The save that completes setup — whichever of the three it is: the year
      with its initial parity, the semesters, or the bell schedule — tells the
      teacher, in Ukrainian and in view of the button they pressed, that setup
      is complete and the rest of the app is open, and offers the next step as
      a prominent action rather than the link at the bottom of the page.
      Where that action leads (the weekly template or the calendar) is
      decided in the plan and stated in `architect-overview.md` §8.6.
- [x] On a narrow screen, where the navigation panel is collapsed, the same
      notice and action are shown; the teacher does not have to open the menu
      to find out the app is open.
- [x] Once setup is complete and the notice has been acted on or the page is
      opened again, `/year` is the ordinary year setup screen — no checklist,
      no completion notice.
- [x] The behaviour of the gate itself does not change: the four conditions,
      `getSetupStatus()`, `requireCompleteSetup()` and the redirect stay as
      T-038 left them.

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
- after the last save, the full menu does appear without a reload, as
  `ADR-018` (Consequences) says it will, but the checklist disappears at the top
  of the page, out of view, and the only way on is «Перейти до календаря» at the
  very bottom. On a narrow screen the new menu items are behind the collapsed
  menu.

Two criteria were moved to `T-048` before implementation (2026-10-04, the
user's decision in the ticket run), where they are stated in full: a
browser-level test that walks a teacher with no rows through the three saves,
and that test run by `npm run gate` and `ci.yml` with its dependency recorded in
an ADR and `docs/tech-stack.md`. They bring the project's first browser-test
dependency and a new `e2e` job in `ci.yml` — a gate-contract change of its own.

Implemented as `architect-overview.md` §8.6 («Як `/year` веде до відкритого
застосунку») states it: the completing save offers the weekly template
(`/schedule`) as the action. Mechanics, including the expected screen after
each save that `T-048` asserts: `docs/architecture/design/T-041-year-setup-way-out.md`.

Evidence, criterion by criterion (PR #50, CI green on `7d2c2fd`):

1. `components/year/setup-checklist.tsx:53`, targets from
   `components/year/setup-steps.ts`; `setup-progress.test.ts` › "links each
   missing item to the section it is entered in", `setup-steps.test.ts`.
2. `components/year/setup-progress.tsx:83` (sticky bar), `:100` («Перейти»);
   `setup-steps.test.ts` › "after the year is saved, the semesters are next and
   link to their section", `setup-progress.test.ts` › "shows the next item and a
   link to its section".
3. `components/year/setup-progress.tsx:114` (`CompletionNotice`, `/schedule`
   first); `setup-progress.test.ts` › "offers the weekly template first…" and the
   walk of `rememberRender` over the renders of one mount; `architect-overview.md` §8.6.
4. `app/(app)/(schedule)/year/page.tsx:203` — the bar is page content, outside
   `AppNav`/`MobileNav`.
5. `setup-progress.test.ts` › "is empty on the ordinary screen", "opened
   complete and left so: the ordinary screen throughout", "opened again after
   completing — the menu, the year switcher — is ordinary" (a PR #50 review
   finding: the router does not remount the page on a navigation that stays on
   `/year`, so the notice is bound to the completing render's `renderId`).
6. No change under `lib/`, `app/(app)/layout.tsx` or `components/navigation/`;
   `lib/auth/setupGate.integration.test.ts` green in CI's integration job.

Not measured in a browser here — the local database was not reachable from
the session; that walk is `T-048`.
