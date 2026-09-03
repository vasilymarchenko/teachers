---
id: ADR-004
title: A weekday rule starts at the later of the year's first day and today
status: accepted
date: 2026-09-03
ticket: T-009
---

## Context

`non_teaching_weekday_rule.valid_from` exists because of finding F-3 of
`docs/architecture/design/expand-fixtures.md` §9: without it, a rule entered in
October reaches back over every Friday since September and silently changes what
the calendar says about weeks that have already been taught — which contradicts
specification §5.2, «історія не переписується».

`schema.md` §4.4 fixed the write rule as `today()`, with one exception stated in
the same paragraph: *«Year setup (T-009) is the one exception: it writes
`valid_from = academic_year.date_from` for the rules it creates as part of the
year frame, which is what makes the fixture's R1–R3 legal from 2026-09-01.»*

T-009 is that screen, and the exception as written is unconditional. Taken
literally it produces two results the rest of the design refuses:

- a methodical day added in March would be dated 1 September and would rewrite
  every Friday of the autumn — the exact case `valid_from` was added to prevent;
- `resolveBoundary()` takes `valid_from` as its `referenceDate`, so «до
  найближчих канікул» chosen in March would resolve to the *autumn* break, a
  date in the past, and the row would be rejected by `ntwr_range_ck` or, worse,
  accepted as a rule that ended months ago.

Both follow from the same thing: the exception was written for the case it was
observed in — setting a year up before it starts — and states a constant where
the case is a condition.

## Options

**Follow §4.4 literally: always `academic_year.date_from`.** Matches the
document with no edit. Costs the two results above; a teacher would have to
delete and re-enter the rule, and could not express «з сьогодні» at all.

**Always `today()`, dropping the exception.** One rule for every writer, and
history is safe. Costs the case the exception was written for: a teacher setting
next year up in August would get rules dated in August, which govern the *end of
the current year* — including Fridays that are still being taught — and the
fixture's R1–R3 could not be produced by the screen that is supposed to produce
them.

**The later of the two.** `max(academic_year.date_from, today())`. Setting the
year up before it starts gives the year's first day, which is the case §4.4
describes and the values the fixture pins. Adding a rule mid-year gives today,
which is what every other writer does. One expression, no branch on intent, and
no way to write a rule that reaches backwards.

## Decision

A `NonTeachingWeekdayRule` written by the year-setup screens starts on
`ruleValidFrom(year.dateFrom, today())` — **the later of the year's first day
and today** — and that date is also the `referenceDate` its boundary resolves
against.

`ruleValidFrom()` is in `lib/domain/schedule/boundaries.ts`, beside
`resolveBoundary()`, and takes `today` as a parameter: the domain has no clock
(overview §8.5).

Editing a rule does **not** recompute it. The existing `valid_from` is kept and
the new boundary resolves against it, so an edit changes where a rule ends and
never which weeks it already governed.

`schema.md` §4.4 has been corrected to state this rule and to point here.

## Consequences

The fixture's R1–R3 remain exactly as `expand-fixtures.md` §3.3 states them, and
the seed keeps producing them, because it writes rows directly rather than
through the screen.

A teacher who sets a year up while it is running gets rules that start today
rather than in September. That is visible — the rules section shows «Діє з» on
every row — and it is the honest answer: the weeks before today were taught
under whatever rules existed then.

`ScheduleTemplate.valid_from` (T-010) faces the same question and should reuse
`ruleValidFrom()` rather than answering it again. Copy-on-write (overview §3.2)
already cuts a version at `today()`, so a template created during year setup for
a year that has not started must not be cut at a date before the year begins.

Revisit if the teacher ever needs a rule to start on a date they choose — a
methodical day known in advance to begin after the winter break. That is a new
field on the form, not a different default, and it would supersede this ADR only
in the sense of adding a fourth case: an explicit `validFrom`, still never
earlier than the year's first day.
