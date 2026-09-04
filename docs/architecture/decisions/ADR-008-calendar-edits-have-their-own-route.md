---
id: ADR-008
title: Editing a lesson from the calendar happens on its own route
status: accepted
date: 2026-09-04
ticket: T-011
---

## Context

Specification §5.3 asks that any single day be editable «прямо з календаря», and
§5.4 that a substitution be entered the same way. T-011 is the first ticket to
write from a calendar screen; T-012 (events) will be the second, and the printed
views of T-013 read the same components.

What the calendar is today (T-007) constrains the answer. All four views are
server-rendered and hold no state: the view switch, the ← → steps, the quick
jumps and the `OWN`/`CLASS` switch are `<Link>`s, every position of the calendar
is a URL that can be bookmarked, and the whole screen works with JavaScript off.
The week view already renders seven day cards side by side, and the `xl`
breakpoint already overflows with the text of a lesson alone (T-021).

An override is addressed by four values — `date`, `view`, `lesson_number` and
the teacher — which is exactly `day_override_slot_uq` (schema §4.9). Whatever
edits it has to name all four.

## Options

**A form inside the lesson row, expanded in place.** The edit happens where the
teacher is looking, with no navigation. It costs the property above: every
calendar view gains client components and a `useActionState` per row, so the
month grid — which renders ~35 days — carries a form per lesson whether or not
one is ever opened. The week card is 1/7 of the width at `xl` and would have to
hold four inputs, a kind choice and three buttons. Rendering the form only for a
row the teacher opened requires client state, which the calendar deliberately
has none of; doing it with `<details>` keeps it server-rendered but still ships
every form in the payload.

**Editing only in the day view, the week linking through to it.** Cheap and
small, and the week card stays a card. But the criterion names both views, and a
teacher who spots the wrong lesson in the week loses her place to fix it — the
week is where a substitution is usually noticed.

**Its own route under the view, linked from the row.**
`/calendar/<view>/<date>/lesson/<n>` names the slot in the URL, so the screen has
no state to hold either, and the `<view>` segment is what «Повернутися» goes
back to. The cost is a navigation per edit, and a screen that has to say what it
is editing — the calendar's context is no longer on screen.

## Decision

The third. A lesson is edited at `/calendar/<view>/<date>/lesson/<n>`, reached
from a «Змінити» link on the row in the day and week views and from «Додати
урок: + N» on the day for a number the day does not show. `?schedule=class`
carries the `OWN`/`CLASS` switch, as on the views themselves.

The route is under the calendar view rather than beside it so that the URL
records where the teacher came from; the editor restates the lesson, the date,
the parity and what the weekly template gives, because that context is what the
navigation cost her.

The month and year cells get no edit link: their day number opens the day.

## Consequences

The calendar stays what T-007 made it — four stateless server-rendered views
whose every control is a link — and the client components of this feature are
three forms on one screen instead of a form per rendered lesson. An edit is a
URL: it can be linked to, opened in a second tab, and reached from anywhere,
which is also what makes «додати урок» possible on a date the template does not
cover at all.

It costs a round trip per edit, and a teacher correcting several lessons of one
day pays it several times. It also duplicates, on the editor, the small amount of
context the calendar was already showing.

T-012 inherits the shape: an event is edited on its own route under the
calendar, not in a popover on the grid.

**Revisit if** a teacher reports the navigation as friction on a day with
several changes — the answer then is not to move the form into the row, but to
let one screen edit the whole day (one form per lesson number of that date),
which keeps the route and removes the repetition. Also revisit if a later
requirement makes an edit depend on state the URL cannot hold, such as dragging
a lesson between two numbers.
