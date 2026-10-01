---
id: T-038
type: ticket
title: A teacher whose year setup is incomplete is sent to year setup, and nowhere else
status: todo
depends_on: [T-009, T-014]
refs:
  - docs/specs/specification.md §3
  - docs/specs/specification.md §4
  - docs/architecture/architect-overview.md §3.5
  - docs/architecture/architect-overview.md §5
  - docs/architecture/architect-overview.md §8.3
---

## Goal

Make a teacher whose year setup is incomplete land on year setup and stay there
until it is complete. Today an account made by `npm run create-teacher` signs in
and is redirected to `/calendar`, which answers with a server error: `expand()`
calls `parityOn()` for every date, and `parityOn()` throws on an empty
`ParityAnchor` list (`lib/domain/schedule/parity.ts`). No other screen means
anything before the year frame exists, so the fix is a gate in front of all of
them rather than an empty state on each.

## Acceptance criteria

- [ ] Setup is complete when all four hold for the teacher: an `AcademicYear`
      exists; it has its initial `ParityAnchor`, the one on the year's first
      day; it has both of its `Semester` rows; and the `BellSchedule` has at
      least one lesson number. The `BellSchedule` belongs to the teacher, not
      to a year, so it is required once and not once per year.
- [ ] One function answers "is this teacher's setup complete", takes `userId`
      first and is the only place those four conditions are spelled. Which year
      the three year conditions are evaluated against when the teacher has
      several is decided in the plan and stated in the architecture document.
- [ ] A signed-in teacher whose setup is incomplete who opens any page of the
      `(app)` group other than `/year` — `/`, `/calendar` and every
      `/calendar/[view]/[date]` including the lesson screen, `/schedule`,
      `/events` — is redirected to `/year`. No such request renders a server
      error.
- [ ] The check runs after `requireUser()` and is keyed on the `userId` it
      returned; it lives where the data is read, not in `proxy.ts`
      (overview §8.3).
- [ ] While setup is incomplete, the navigation panel offers only year setup
      and sign-out — no link leads to a page that would bounce back.
- [ ] On `/year` in that state the teacher is told, in Ukrainian, that the year
      has to be set up before the rest of the app opens, and sees which of the
      four are still missing. All four are entered on that screen without
      leaving it; the non-teaching periods and weekday rules of specification
      §3.1 and §3.4 stay optional and are marked as such.
- [ ] Creating the year writes its initial `ParityAnchor` in the same
      transaction, as it does today, so a teacher who passed the gate cannot
      reach `expand()` with an empty anchor list. A test pins that pairing.
- [ ] Once setup is complete the gate is gone: `/` opens the calendar, the full
      navigation is back, and `/year` is the ordinary year setup screen.
- [ ] Undoing any of the four — deleting the last `AcademicYear`, a `Semester`,
      or the last `BellSchedule` row — puts the teacher back behind the gate
      instead of on a failing or dead-ended screen.
- [ ] `npm run db:seed` produces a teacher whose setup is complete, so the demo
      scenario is not gated.
- [ ] An integration test covers a user with no rows at all and a user missing
      each one of the four: each gated route redirects to `/year`, and `/year`
      renders.
- [ ] `app/(app)/error.tsx` exists and says, in Ukrainian and inside the shell,
      that the page could not be loaded — a server fault no longer replaces the
      whole app with the framework's English screen.
- [ ] `architect-overview.md` states the rule — no screen but year setup until
      setup is complete, what complete means and why those four — in the
      section the gate belongs to, and `CLAUDE.md` "Project status" mentions it.

## Notes

Found on the deployed app with the first real teacher account, 2026-10-01: the
demo user from `db:seed` never meets the state, because the seed always creates
a year and its anchor.

`app/(app)/(calendar)/calendar/[view]/[date]/page.tsx` already treats
`getYearFrame() === null` as a normal state and renders `YEAR_NOT_SET_UP`; with
the gate in place that branch is reachable only for a date outside every year
the teacher has, which stays as it is.
