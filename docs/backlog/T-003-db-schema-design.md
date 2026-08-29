---
id: T-003
type: ticket
title: Detailed DB schema design document
status: done
depends_on: [T-001]
refs:
  - docs/architecture/design/schema.md
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

- [x] Every table from overview §4 with columns, types, nullability, defaults,
      and enum definitions.
- [x] `btree_gist` extension and the `EXCLUDE` constraint on
      `ScheduleTemplate (user_id, view, daterange(valid_from, valid_to))`.
- [x] Column types follow overview §8.5: `time` for `BellSchedule`, `date` with
      no timezone for lesson and event dates.
- [x] Every profile table has `user_id NOT NULL` and an index that starts with
      `user_id` (overview §8.4).
- [x] `TemplateSlot` payload split by `view` as decided in overview §3.3, with
      the Zod boundary named as the place `view`-specific validation happens.
- [x] `boundaryDate` + `boundaryKind` pairs modelled per overview §8.1 wherever
      a symbolic boundary is stored, with `boundaryDate` exclusive.
- [x] `NonTeachingWeekdayRule` has a `validFrom` resolved at write time as well as
      its boundary; without one the rule reaches back over dates that have already
      passed (`docs/architecture/design/expand-fixtures.md` §9, F-3).
- [x] Migration order stated, plus which constraints must exist before the
      first seed run.
- [x] A `seed` script is specified: Ukrainian demo data (root `CLAUDE.md`
      language rule), sized to exercise the T-001 fixture scenario.
- [x] No table or column name that lacks a glossary entry.

## Notes

Delivered as `docs/architecture/design/schema.md`: eleven tables (ten ours plus
better-auth's `user`), eight enum types, three `EXCLUDE USING gist` constraints,
the migration set 0000–0002 and the seed specification.

Four decisions the write-up forced, each recorded in §12 of that document and,
where it changed an already-published fact, in the document that published it:

- **`AcademicYear` no longer stores the initial parity.** Overview §4 and
  glossary §1 listed it while overview §3.5 said the initial value *is* a
  `ParityAnchor`; the two could disagree and only the anchor is read. Both
  documents corrected in this commit — this is the one change here that is a
  decision rather than a transcription.
- **`NonTeachingWeekdayRule.validFrom`** added, closing F-3 of
  `design/expand-fixtures.md` §9. Glossary §4 gained the term.
- **`BellSchedule` stays scoped to the user, not the year** (overview §4 read
  literally). The consequence — editing a bell time moves the displayed times of
  past lessons — is recorded for T-009 rather than fixed with a column nobody has
  asked for yet.
- **`DayOverride` carries no per-day time.** Specification §5.3's «змінити … час»
  is served by changing the `lessonNumber`; a nullable time pair is one migration
  away if it turns out not to be.

Three smaller rules the review of this document added, each recorded where the
implementation will read it: a second template edit on the same day updates the
version in place rather than cutting it to zero length (§4.7, and a T-004
criterion); `updated_at` is maintained by Drizzle's `$onUpdate`, because the SQL
default only fires on `INSERT` (§1, and a T-004 criterion); and a recurring
`Event` is one day per occurrence — `event_recurring_span_ck` (§4.10). The
inclusive/exclusive rule was also restated: validity boundaries are exclusive,
entity ranges (`AcademicYear`, `Semester`, `NonTeachingPeriod`, `Event`) have an
inclusive `dateTo`. Overview §8.1 corrected accordingly.

Two further items are handed to other tickets rather than decided here: a
`lessonNumber` with no `BellSchedule` row (T-005/T-010, §12 F-3) and the
better-auth tables having to land in T-004's first migration because every
profile table has a foreign key to `user` (added to T-004's criteria).

`recurrenceKind` (`NONE` | `WEEKLY` | `MONTHLY` | `YEARLY`) and `Event.title` /
`Event.note` are new domain terms; per `docs/backlog/CLAUDE.md` they went into
`glossary.md` first.
