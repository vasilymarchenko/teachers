---
id: T-055
type: ticket
title: Plan a new template version from a future date — after a break or from a date — and cancel it by overwriting
status: todo
depends_on: [T-059]
refs:
  - docs/architecture/architect-overview.md §10.8
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §8.1
  - docs/architecture/design/expand-fixtures.md §3.8
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
  - docs/architecture/decisions/ADR-029-the-model-proposes-and-deterministic-code-writes.md
  - docs/specs/specification.md §5.2
---

## Goal

A teacher who knows that a new timetable takes over after the autumn break can
enter it now. The template editor offers «новий розклад з…» with two choices,
«після канікул» and «з дати», and the version it creates starts on that date
instead of today. The version in force is trimmed there, so the past and the
days until then are untouched. A planned version can be cancelled, and a
change made today can be carried into it. The decision and its reasons are in
overview §10.8 (Q-008).

## Acceptance criteria

- [ ] The cut of a template edit may be a date after `today()`, never before
      it. `planTemplateEdit()` takes the cut from its caller and refuses one
      earlier than `today()`, which is still read from `lib/time/today.ts`.
      The check runs at write time, so a form opened yesterday cannot cut into
      the past after midnight.
- [ ] «Після канікул» resolves at write time to the first day after the
      nearest break that has not ended on `today()` (its `dateTo` is on or
      after `today()`), so that chosen during a break it means the day after
      that break. The symbol is not stored: the screen shows the resolved
      date. A break that ends after the year has no such day, and the choice
      is refused with a message, not a version outside the year.
- [ ] The form sends the start symbol together with the date it showed. The
      server resolves the symbol again and writes only if the two agree;
      otherwise it writes nothing and shows the form again with the new date,
      as ADR-029 does for import.
- [ ] A planned version (one whose `validFrom` is after `today()`) is edited
      through the same day save. Saving a day of the version in force while a
      planned version lies ahead asks «застосувати й до розкладу з <дата>?»,
      and on «так» applies the same change to the planned version's slots in
      the same transaction.
- [ ] «Скасувати запланований розклад» replaces the planned version with a
      copy of the slots of the version before it, over the planned version's
      own range. No row is deleted outside that replace, no gap opens, and no
      `validTo` moves forward. Where the planned version ran to the end the
      trimmed version had, or later, the calendar after cancelling equals the
      calendar before planning. Where a gap follows the planned version
      (it was given an earlier end, «до дати Х»), cancelling restores only the
      planned range, and the confirmation of cancelling names the gap with its
      dates.
- [ ] The strip of versions marks a planned version as planned, with its start
      date, and the trim warning of overview §3.2 I2 names the planned date.
- [ ] `design/expand-fixtures.md` gains the cases: a cut on a future date, a
      cut on the first day after a break, «після канікул» chosen during that
      break, a second cut on the same planned date (replace), a change applied
      to both versions, a cancellation, and a cancellation of a planned version
      followed by a gap.
      Each is a unit test of the planning functions.
- [ ] An ADR records that the cut may be in the future and why cancelling
      overwrites instead of deleting. `architect-overview.md` §3.2 states I1
      as it now holds, and `glossary.md` §3 states the planned version as
      built. `specification.md` §5.2 states that a new timetable may start on a
      later date, «після канікул» or «з дати», and that a planned one can be
      cancelled.

## Notes
