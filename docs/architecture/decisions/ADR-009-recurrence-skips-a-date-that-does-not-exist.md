---
id: ADR-009
title: A recurrence skips a month or year that has no such date
status: accepted
date: 2026-09-05
ticket: T-012
---

## Context

`Event.recurrenceKind` is `NONE | WEEKLY | MONTHLY | YEARLY` (schema §4.10), and
T-012
writes the function that turns a repeating event into the dates it falls on.
Two of the three periods have dates that do not exist in every period:

- **monthly** — an event on the 29th, 30th or 31st has no counterpart in a month
  that is shorter, and February is short every year;
- **yearly** — an event on 29 February has a counterpart only in a leap year.

A repeating event is one day per occurrence (`event_recurring_span_ck`), so
there is no span to fall back on, and the expansion is computed on every read
rather than stored per occurrence (overview §1) — whatever rule is chosen is
applied afresh in every window, including windows of the past.

`date-fns`, which the domain already uses for calendar arithmetic
(`lib/domain/schedule/dates.ts`), clamps: `addMonths('2026-01-31', 1)` is
28 February 2026. So the rule is not a free choice at the library level — it is
the default that has to be either accepted or worked around.

## Options

**Clamp to the last day of the period.** 31 January → 28 February → 31 March;
29 February → 28 February in a common year. The teacher sees an occurrence every
period, which reads as «щомісяця» keeping its promise. It costs the invariant
that an occurrence falls on the date the teacher chose: the event appears on
28 February, a date she never entered, and a reader of the calendar cannot tell
that day's mark from one she did enter. Stepping month by month with `addMonths`
from the *previous* occurrence would be worse still — the clamp is sticky, so
31 January would become 28 February and then 28 March.

**Refuse the input.** The form would not accept the 29th, 30th or 31st for a
monthly event, nor 29 February for a yearly one. Nothing is ever surprising, and
the model loses shapes it can hold: «останній день місяця» is a real thing a
teacher writes down, and refusing 31 October for a monthly reminder because
November is short is an answer she cannot act on.

**Skip the period.** A month with no 31st carries no occurrence; a common year
carries no 29 February. The date of every occurrence is the date that was
entered, always. The cost is that a monthly event on the 31st occurs seven times
a year and not twelve, which is visible in the calendar and nowhere explained.

## Decision

The expansion **skips** a period that has no such date. `occurrencesInRange()`
builds each candidate as a `YYYY-MM-DD` string and accepts it only if
`isIsoDate()` does — the same check the URL parser uses — and it never steps
with `addIsoMonths()` or `addIsoYears()`, whose clamping is what this decision
refuses. `lib/domain/events/recurrence.test.ts` pins both cases (M1, Y1).

## Consequences

Every occurrence of a repeating event is on the day-of-month the teacher chose,
which is what makes the calendar's marks checkable against the events screen.

A monthly event on the 29th–31st has fewer occurrences than there are months,
and the screen does not say so — the teacher discovers it by looking at the
calendar. That is the accepted cost; the mitigation, if it is ever paid for, is
a hint on the form rather than a change to the rule.

Revisit if a teacher asks for «останній день місяця» as a *thing to schedule* —
that is not a clamp but a fourth `recurrence_kind` (`MONTHLY_LAST_DAY`), a
migration and an expansion rule, and it would leave this decision intact for the
kinds that already exist.
