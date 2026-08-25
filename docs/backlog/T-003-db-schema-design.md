---
id: T-003
type: ticket
title: Detailed DB schema design document
status: todo
depends_on: [T-001]
refs:
  - docs/architecture/design/expand-fixtures.md
  - docs/architecture/architect-overview.md §3
  - docs/architecture/architect-overview.md §4
  - docs/architecture/architect-overview.md §8
  - docs/architecture/glossary.md
---

## Goal

Write `docs/architecture/design/schema.md` (English, mechanics only): the full
DDL behind the model sketched in overview §4, referencing the overview for
rationale rather than repeating it.

## Acceptance criteria

- [ ] Every table from overview §4 with columns, types, nullability, defaults,
      and enum definitions.
- [ ] `btree_gist` extension and the `EXCLUDE` constraint on
      `ScheduleTemplate (user_id, view, daterange(valid_from, valid_to))`.
- [ ] Column types follow overview §8.5: `time` for `BellSchedule`, `date` with
      no timezone for lesson and event dates.
- [ ] Every profile table has `user_id NOT NULL` and an index that starts with
      `user_id` (overview §8.4).
- [ ] `TemplateSlot` payload split by `view` as decided in overview §3.3, with
      the Zod boundary named as the place `view`-specific validation happens.
- [ ] `boundaryDate` + `boundaryKind` pairs modelled per overview §8.1 wherever
      a symbolic boundary is stored, with `boundaryDate` exclusive.
- [ ] `NonTeachingWeekdayRule` has a `validFrom` resolved at write time as well as
      its boundary; without one the rule reaches back over dates that have already
      passed (`docs/architecture/design/expand-fixtures.md` §9, F-3).
- [ ] Migration order stated, plus which constraints must exist before the
      first seed run.
- [ ] A `seed` script is specified: Ukrainian demo data (root `CLAUDE.md`
      language rule), sized to exercise the T-001 fixture scenario.
- [ ] No table or column name that lacks a glossary entry.

## Notes
