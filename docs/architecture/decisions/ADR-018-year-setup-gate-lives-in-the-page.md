---
id: ADR-018
title: The year-setup gate is called by each page, and any one complete year opens it
status: accepted
date: 2026-10-01
ticket: T-038
---

## Context

A teacher account made by `npm run create-teacher` has no `AcademicYear`, no
`ParityAnchor`, no `Semester` and no `BellSchedule`. Every screen but year setup
reads that frame, and the calendar does not degrade without it: `expand()` calls
`parityOn()` for each date and `parityOn()` throws on an empty anchor list. The
first real account met this as a server error on the page it was redirected to
after signing in. T-038 puts one gate in front of every screen rather than an
empty state on each.

Two things had to be chosen, and both become a contract later tickets are
written against.

**Where the check runs.** Overview §8.3 already rules out `proxy.ts`: it is UX,
it verifies nothing, and it must not read the database. That leaves the `(app)`
layout, which every gated page shares, and the pages themselves. A layout in
the App Router is not rendered again on a client-side navigation between two of
its pages — the framework's own authentication guide warns against checks there
for that reason.

**Which year the conditions are read against.** Three of the four conditions —
the year exists, it has the `ParityAnchor` on its first day, it has both
`Semester` rows — belong to a year, and a teacher may have several: next
September's year is prepared while this one is still running (T-009).

## Options

### Where the check runs

**In the `(app)` layout.** One call, impossible to forget on a new page. But it
runs on the first load and on a full reload only: a teacher who deletes a
`Semester` on `/year` and then clicks «Календар» navigates without the layout
rendering, so the gate is skipped by exactly the clicks it exists for. A layout
also cannot see which page it is wrapping, so `/year` would have to move out of
the group to be exempt.

**In each page, through one function.** `requireCompleteSetup()` replaces
`requireUser()` at the top of a page: the same boundary, then the setup check,
keyed on the `userId` the boundary returned. It runs on every navigation,
because a page always renders. The cost is that a new page can forget it.

### Which year

**Every year must be complete.** The strictest reading. Creating next
September's year in August — a year with no semesters yet — would close the
whole application until they are entered, in the middle of the year being
taught.

**The year `pickYear()` selects** — the one covering today, else the next to
start, else the last. One year, one answer, and the same rule the setup screen
already uses. But it makes the gate depend on the date: in July, with the old
year over, the half-prepared next year becomes "the" year and closes the
calendar of the year that just ended, which the teacher may still be printing
from.

**Any one year is complete.** The gate asks whether the application has a frame
to stand on at all. It never closes because of a year being prepared, and it
does not depend on today's date.

## Decision

Each page of the `(app)` group except `/year` calls `requireCompleteSetup()`
(`lib/auth/setupGate.ts`) in place of `requireUser()`. The layout reads the
same status only to decide which menu to offer; it never redirects.

Setup is complete when the teacher has at least one `BellSchedule` row and **at
least one** `AcademicYear` that has its initial `ParityAnchor` and both of its
`Semester` rows. `getSetupStatus()` (`lib/db/queries/setupStatus.ts`) is the
only place those conditions are written; it reports the three year conditions
per year, and the checklist on `/year` shows them for the year being edited.

## Consequences

A new page under `app/(app)` must call `requireCompleteSetup()`. Nothing in the
type system says so; `lib/auth/setupGate.integration.test.ts` does — it finds
the pages by walking the directory and fails for one that renders, or redirects
anywhere else, for a teacher with an incomplete setup. That test needs a
database, so the omission is caught by `ci.yml` rather than by the unit suite.

The status is read twice on a full page load, once by the layout and once by
the page: four small owner-restricted reads each time. Not cached; worth
revisiting if the shell ever reads enough to show up in a trace.

The gate guarantees a frame exists, not that every date has one. A complete
year plus an incomplete second year lets the teacher open a date in the second
one; that renders through the paths that already handle it — the year exists,
so its anchor exists (written in the same transaction as the year), and a date
outside every year is the `YEAR_NOT_SET_UP` branch the calendar already has.

The menu shown by the layout can be one navigation stale in principle, since
the layout is not rendered again between pages. In practice every write that
changes the status is a Server Action on `/year`, and an action's revalidation
renders the layout again. If a write that changes the status ever appears on
another route, it has to revalidate the layout too.

Revisit if years stop being independent of one another — for instance if a
screen starts requiring the year that covers today specifically. Then "any one
year" no longer says what that screen needs, and the status's per-year entries
are what it would be rebuilt from.
