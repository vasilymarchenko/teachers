---
id: ADR-010
title: The deadline done toggle is the one write control on the calendar grid
status: accepted
date: 2026-09-05
ticket: T-012
---

## Context

ADR-008 decided that an edit reached from the calendar happens on its own route,
`/calendar/<view>/<date>/lesson/<n>`, and recorded the property that made the
choice cheap: «The calendar stays what T-007 made it — four stateless
server-rendered views whose every control is a link». It then wrote the same
shape forward: «T-012 inherits the shape: an event is edited on its own route
under the calendar, not in a popover on the grid.»

T-012 has landed and that sentence is now true of one thing and false of
another. An event *is* edited on its own screen — `/events`, which is where both
forms live; nothing on the grid edits an event. But T-012's fourth acceptance
criterion is «Marking a deadline done and undone from the calendar», and what
implements it is `components/calendar/event-done-toggle.tsx`: a `"use client"`
component with a `useActionState` per deadline, rendered inside the day and week
views. The grid therefore carries a write control, which ADR-008's consequence
says it does not.

The difference between the two cases is the shape of the write. A lesson
override is four values and a kind choice — the form ADR-008 measured against a
week card at `xl`. A deadline's `done` is one boolean with no input to fill in,
and the whole interaction is the click that submits it.

## Options

**Send «виконано» to a route as well**, `/calendar/<view>/<date>/event/<id>`, so
that the rule holds without exception. It keeps one sentence true and costs a
navigation, a screen and a «Повернутися» for a checkbox: the teacher looks at
today, sees a deadline she has finished, and pays a page load and a second click
to say so. The route would exist only to host one button.

**A `<Link>` to a Route Handler that toggles and redirects back**, keeping the
grid free of client components. It is a GET that writes — reachable by a
prefetch and by anything that walks links — and the toggle's own reason for
answering as `FormState` (a deadline deleted in another window must come back as
a message, not as a button that does nothing) has nowhere to land.

**One client component, only where the write is a single click.** The grid gains
`EventDoneToggle` in the day and week views. It costs exactly what ADR-008's
rejected option A costs, in proportion to how much is rendered: one small client
component per deadline shown, in the two views that show a handful, and none in
the month and year cells, which continue to open the day.

## Decision

The third. `EventDoneToggle` is a client component on the day and week views,
and it is the **only** write control on the calendar grid.

The line is drawn at the shape of the interaction, not at the entity: a write
whose whole input is the click that submits it may sit on the grid; a write with
fields to fill in gets a route, exactly as ADR-008 decided. `done` is the only
column in the model that qualifies today — it is one boolean, it is written by
`setEventDoneAction` alone, and no form touches it.

Consequently ADR-008's «every control is a link» describes T-007 and T-011, not
the calendar as it now stands; `architect-overview.md` §5 states what is true
now, and this ADR is why. ADR-008 is not superseded — its decision, that a
lesson is edited at its own route, is unchanged and is what `/events` and the
lesson editor both still follow.

## Consequences

The day and week views are no longer purely server-rendered: they ship one
client component per deadline they show. The month and year views, and the
printed views T-013 will build, stay exactly what T-007 made them — which is
what keeps the cost bounded, because those are the views that render 35 and 365
cells.

With JavaScript off the toggle submits as a plain form post and the view
re-renders, so the property ADR-005 protects survives; what is lost is the
message on failure, which needs the round trip anyway.

**Revisit if** a second write comes along that argues it is also «just one
click». Two exceptions are a rule that was stated wrongly: the answer then is to
name the category in the overview and let the grid host that category, rather
than to grow a list of one-offs. Also revisit if the day or week view starts
rendering enough deadlines for one client component each to be measurable —
neither view is bounded by anything but the teacher's own entries.
