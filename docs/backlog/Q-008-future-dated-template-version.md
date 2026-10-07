---
id: Q-008
type: question
title: May a template edit start on a future date, not only today
status: open
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

The cut is always `today()`. Import (T-052) does the same: it creates the new
version from the day the teacher confirms it, and says so on the confirmation
screen.

## Cost of changing later

`planTemplateEdit()` gains a `cutAt` that may be later than `today()` but never
earlier. I1 holds, because the past is still never edited. The version in force
is trimmed at the future date instead of at today, and `capToNextVersion()`
already handles a version that begins later. The cost is one parameter, its
fixtures in `design/expand-fixtures.md`, and a date field on the confirmation
screen. The schema does not change.

## Needed from

The teacher: whether a new timetable is ever known in advance, and how far.
