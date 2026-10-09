---
id: Q-008
type: question
title: May a template edit start on a future date, not only today
status: answered
depends_on: []
refs:
  - docs/architecture/architect-overview.md §10.8
  - docs/architecture/architect-overview.md §3.2
  - docs/specs/specification.md §5.2
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
---

## Question

A template edit always cuts at `today()` (overview §3.2 I1). It cannot start
the new version on a later date. Importing a timetable that the teacher
received ahead of time («з понеділка 13.10 новий розклад») runs into this. The
teacher has to import it on that Monday, or accept that it applies from the
day it was imported. Should a template edit be able to start on a future date,
and if so, what happens to the version in force between today and that date?

## Current default

Answered: yes. A new timetable is often known ahead of time, typically one
that takes over after a break. A template edit may cut on a future date,
never an earlier one than `today()`, so I1 still forbids only the past. That
is already true of a `DayOverride` and an `Event`, which may both be entered
for a future date. The usual start is «після канікул», resolved when the
form shows it. The date shown is what is written, and it is checked at write
time against `today()`.
A planned version has no cancel action. It is changed like any other version:
its days through the day save, its range by planning another version from a
date. No version that has started is deleted, and no `validTo` moves forward. A
planned version itself has no past, so a change on its start date replaces it
through the existing `replace` path, carrying over what the change leaves
alone. A cancellation
would have to know what the planning changed, which no row records.

The decision is recorded in `docs/architecture/architect-overview.md` §10.8,
and the work is T-055. This file is the record that it was asked.

## Cost of changing later

The planning domain is cheap: `planTemplateEdit()` already plans against the
version in force on its cut date, and `capToNextVersion()` already stops a new
version where a later one starts. What the answer costs is behaviour, and T-055
carries it: a change made today has to be offered to the planned version too,
and the editor has to show which version it edits. A change of mind costs the
teacher re-entering lessons, because there is nothing to cancel. The schema
does not change.

## Needed from

The teacher: answered. A new timetable after a break is the case that occurs.
