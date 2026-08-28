---
id: Q-006
type: question
title: How `isTaughtByMe` matches a CLASS lesson to an OWN lesson
status: open
depends_on: []
refs:
  - docs/architecture/architect-overview.md §10.6
  - docs/architecture/architect-overview.md §4
  - docs/architecture/design/expand-fixtures.md §8.6
  - docs/specs/specification.md §6.2
---

## Question

A `CLASS` lesson is marked «цей урок веду я» by comparing it with the `OWN`
schedule for the same date. Comparing `lessonNumber` alone is wrong; the fixture
document pins `lessonNumber` + `subject`. Is the residual ambiguity of comparing
free-text subjects acceptable, or does the `CLASS` `TemplateSlot` need an
explicit flag the teacher sets by hand?

## Current default

`lessonNumber` + `subject` equality against the resolved `OWN` day, decided in
`docs/architecture/design/expand-fixtures.md` §8.6 and stated in
`architect-overview.md` §4. No stored field.

## Cost of changing later

An explicit flag is a nullable boolean column on the `CLASS` slot table plus one
checkbox in the template editor — a migration on a table with a handful of rows,
and a change to the render rule in one place. The `expand()` contract does not
change either way: `isTaughtByMe` stays a computed field on `ResolvedLesson`.

## Needed from

The teacher: whether the same subject name ever appears twice in one slot across
their own lessons and their class's timetable. If it never does, the default is
exact and no column is needed.
