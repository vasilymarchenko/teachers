---
id: T-055
type: ticket
title: Plan a new template version from a future date — after a break or from a date — changed like any other version, with no cancel
status: todo
depends_on: [T-059]
refs:
  - docs/architecture/architect-overview.md §10.8
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §8.1
  - docs/architecture/design/expand-fixtures.md §3.8
  - docs/architecture/design/T-005-schedule-domain.md
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
  - docs/architecture/decisions/ADR-029-the-model-proposes-and-deterministic-code-writes.md
  - docs/specs/specification.md §5.2
---

## Goal

A teacher who knows that a new timetable takes over after the autumn break can
enter it now. The template editor offers «новий розклад з…» with two choices,
«після канікул» and «з дати», and the version it creates starts on that date
instead of today. The version in force is trimmed there, so the past and the
days until then are untouched. A change that starts before a planned version
never stops at it silently, and the teacher can carry it into the planned
version. A planned version has no cancel action: it is changed like
any other version. The decision and its reasons are in
overview §10.8 (Q-008).

## Acceptance criteria

- [ ] The cut of a template edit may be a date after `today()`, never before
      it. `planTemplateEdit()` takes the cut from its caller and refuses one
      earlier than `today()`, which is still read from `lib/time/today.ts`.
      The check runs at write time, so a form opened yesterday cannot cut into
      the past after midnight.
- [ ] Today one date, `cutAt = today(now)`, serves every step of a template
      edit. With a future cut it splits in two, and each step names the date
      it uses:
      - `today(now)` is used for the guard that the cut is not in the past, and
        for resolving «після канікул»;
      - everything else is planned on the cut. This covers the version in force
        (`getTemplateVersionInForce()`) and the next version's start
        (`getNextTemplateVersionStart()`). It covers the boundary frame and the
        reference date of `resolveBoundary()` (`getBoundaryFrame()`,
        `ruleValidFrom(yearStart, cut)`), and the boundary inherited from the
        version in force. It covers the slots the new version starts from, the
        check that `validTo` is after the cut, and the trim in
        `planTemplateEdit()`.
      This way a version planned in another semester gets the default
      «до кінця семестру» of *that* semester, never one that ends before it
      starts.
- [ ] «Після канікул» resolves, when the form shows it, to the first day after the
      nearest break that has not ended on `today()` (its `dateTo` is on or
      after `today()`). Only `NonTeachingPeriod.kind = BREAK` counts, never a
      public holiday or another non-teaching period, as for `NEXT_BREAK`. This
      is so that chosen during a break it means the day after
      that break. The symbol is not stored: the screen shows the resolved
      date. A break that ends after the year has no such day, and the choice
      is refused with a message, not a version outside the year. Where no
      break that has not ended is set up at all, «після канікул» is shown
      unavailable, with «канікул попереду не внесено» and a link to the year
      setup, and «з дати» stays.
- [ ] The form sends the date it showed for «після канікул», and the server
      checks it at write time as it checks «з дати»: never before `today()`.
      Breaks edited between the form and the save do not move it, as a
      boundary resolved at write time does not move (overview §8.1). «З
      сьогодні» is `today()` at write time, as now.
- [ ] A planned version (one whose `validFrom` is after `today()`) is edited
      through the same day save. A change that starts on a date D, while a
      planned version starts on S, has an outcome that depends only on where
      D falls and, before S, on where the change's own boundary falls. It is
      the same for a day save and for a new timetable (overview §10.8):
      - D after S: the change edits the planned version from D, as any
        version is edited.
      - D equal to S: the change goes through the `replace` path of
        `planTemplateEdit()`. The planned version has no past, so its row is
        replaced by one that starts from the same slots with the change
        applied. A day save here is an ordinary edit of the planned version,
        as the second edit of a day is today, and the screen asks nothing. A
        new timetable from S replaces the planned version as a whole, and the
        screen says so before saving.
      - D before S, with the change's own `validTo` (its boundary resolved on
        D) on or before S: `capToNextVersion()` does not cap it, the change
        does not touch the planned version, and the screen neither warns nor
        offers a carry.
      - D before S, with the change's own `validTo` after S:
        `capToNextVersion()` stops the change at S, and the screen says so
        before saving. The teacher may carry it into the planned version. That
        overwrites the change's own scope there: the lesson numbers the day
        save's `entries` name, on the same weekday and parity weeks, and the
        whole week for a new timetable. The editor sends an entry for every
        row of the day, so its carry overwrites the whole day. A day save
        that names one lesson overwrites only that lesson in the planned
        version and leaves its other planned lessons as they are. The
        overwrite runs in the same transaction, as a save on the planned
        version's start date (the «D equal to S» case). No change is merged
        lesson by lesson.
      - Before a carried change is saved, the screen lists, among the rows
        the carry writes, those where the planned version differed from the
        version in force, so that nothing planned is lost unseen. Where there
        are none, the screen only asks.
      - With more than one planned version ahead, the change meets only the
        nearest one, which is the one that caps it. A carry goes into that
        one. Each later planned version is named with its start date and
        offered the same carry on its own, with its own list of the rows it
        would replace. A carry into one never writes into another.
- [ ] The day save's target (T-059's `{ view, weekday, parity }`) gains two
      fields, parsed by its target schema. The command, not its adapter,
      applies them:
      - `from`, where the save starts. Absent, the save cuts at `today()`
        read at write time. Present, it is `{ date, whenPassed }`: the save
        cuts at `date`, and when `date` is before `today()` at write time,
        `whenPassed: "refuse"` refuses the save (`field: "target.from"`) and
        `whenPassed: "today"` cuts at `today()` instead.
      - `carryInto`, the start dates of the planned versions the save is
        carried into, empty when absent. For each, the same command saves the
        same `entries` with `from` set to that start, in the same
        transaction. A date that is not the start of a planned version the
        save is capped at (the nearest, or a later one as above) refuses the
        whole save with `field: "target.carryInto"` and writes nothing.
      Each caller maps onto these fields. The tab of the version in force
      sends no `from`. A planned version's tab sends
      `{ date: D, whenPassed: "today" }`. «Новий розклад з…» sends
      `{ date, whenPassed: "refuse" }`. Import sends no `from` for «з
      сьогодні» and `{ date, whenPassed: "refuse" }` for «після канікул» and
      a date (T-052, T-053). The editor's answer to the carry question fills
      `carryInto`. A save with a carry is therefore one command call, and the
      Server Action opens no transaction (T-059). Integration tests save a
      day with a carry and assert that both versions change in one
      transaction, and save one whose `carryInto` names a date that is no
      longer a planned start and assert that nothing is written.
- [ ] There is no «скасувати запланований розклад». A planned version is
      changed the way any version is changed. Its days change through the day
      save. Its range changes by planning another version from a date, and a
      version planned from the same date replaces it (`replace`). No version
      that has started is deleted, and no `validTo` moves forward
      (`planTemplateEdit()`, `design/T-005-schedule-domain.md`), so a change
      of mind costs the teacher re-entering the lessons. The decision and why
      the alternatives were rejected are in overview §10.8.
- [ ] The editor edits the version in force on a date D, which the URL
      carries as it carries the view, the parity week and the day. D
      defaults to today, which is the editor as it is now. The editor reads
      and saves the version in force on D, and its saves start on D. No save
      cuts before today, so a version that has ended stays listed and read
      only.
      - Above the grid there is a tab for the version in force today and one
        for each planned version, each with its start date. A planned
        version's tab sets D to its start, so a save there edits it (the
        «D equal to S» case above).
      - The tab of the version in force carries no D in the URL. Its saves
        cut at `today()` read at write time, as the editor does now. A form
        opened before midnight and saved after it saves from the new day,
        and is not refused.
      - A planned version's tab carries D, and its saves cut at the later of
        D and `today()` read at write time. Once the planned start has come,
        the version is in force, and a save edits it from today. This is the
        only outcome left, since the days before today cannot change.
      - «Новий розклад з…» sets D to the chosen date. A date the teacher
        chose that has passed by the time of the save is refused with a
        message and the form is shown again, as the first criterion states.
        The cut does not move silently.
      - The heading always says which version is being edited, for example
        «Ви редагуєте розклад, що почне діяти 02.11».
      - An integration test opens a planned version's tab, changes a Monday,
        and saves. No warning that the planned version is replaced is shown.
        The change shows in the calendar from the planned start, the planned
        version's other days are as they were, its range is unchanged, and
        the version in force today is unchanged.
      - Integration tests with the system time fixed (as in T-060) cover
        three saves across midnight:
        - the tab of the version in force, opened at 23:58 and saved at
          00:01, saves from the new day;
        - a planned version's tab, saved on its start date, saves from that
          date;
        - «Новий розклад з…» with the date chosen at 23:58 as today, saved
          at 00:01, is refused and writes nothing.
- [ ] The strip of versions marks a planned version as planned, with its start
      date, and the trim warning of overview §3.2 I2 names the planned date.
- [ ] `design/expand-fixtures.md` gains the cases: a cut on a future date, a
      cut on a future date in the next semester with the default boundary
      (its `validTo` is the end of that semester), a cut on the first day
      after a break, «після канікул» chosen during that
      break, a second cut on the same planned date (replace), and a version
      planned from a later date than a planned one, which trims it. They also
      cover a day saved before a planned version and carried into it, once
      where the planned day equals the version in force and once where it
      differs (the replaced rows are listed). They cover a day saved before a
      planned version whose own boundary ends before the planned start, and
      one whose boundary ends exactly on it: neither is capped, and no carry
      is offered. Last, a new timetable before a planned version, carried and
      not carried.
      Each is a unit test of the planning functions.
- [ ] An ADR records that the cut may be in the future, and why a planned
      version has no cancel action, with the two rejected rules of overview
      §10.8. `architect-overview.md` §3.2 states I1
      as it now holds, and `glossary.md` §3 states the planned version as
      built. `specification.md` §5.2 states that a new timetable may start on a
      later date, «після канікул» or «з дати», and that a planned one is
      changed like the current one, not cancelled.

## Notes
