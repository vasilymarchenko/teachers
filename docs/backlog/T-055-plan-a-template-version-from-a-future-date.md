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
- [ ] «Після канікул» resolves at write time to the first day after the
      nearest break that has not ended on `today()` (its `dateTo` is on or
      after `today()`). Only `NonTeachingPeriod.kind = BREAK` counts, never a
      public holiday or another non-teaching period, as for `NEXT_BREAK`. This
      is so that chosen during a break it means the day after
      that break. The symbol is not stored: the screen shows the resolved
      date. A break that ends after the year has no such day, and the choice
      is refused with a message, not a version outside the year.
- [ ] The form sends the start symbol together with the date it showed. The
      server resolves the symbol again and writes only if the two agree;
      otherwise it writes nothing and shows the form again with the new date,
      as ADR-029 does for import.
- [ ] A planned version (one whose `validFrom` is after `today()`) is edited
      through the same day save. A change that starts on a date D, while a
      planned version starts on S, has an outcome that depends only on where
      D falls and, before S, on where the change's own boundary falls. It is
      the same for a day save and for a new timetable (overview §10.8):
      - D after S: the change edits the planned version from D, as any
        version is edited.
      - D equal to S: the change replaces the planned version, and the screen
        says so before saving.
      - D before S, with the change's own `validTo` (its boundary resolved on
        D) on or before S: `capToNextVersion()` does not cap it, the change
        does not touch the planned version, and the screen neither warns nor
        offers a carry.
      - D before S, with the change's own `validTo` after S:
        `capToNextVersion()` stops the change at S, and the screen says so
        before saving. The teacher may carry it into the planned version. That
        overwrites the same scope there: the same weekday and parity weeks
        for a day save, the whole week for a new timetable. The overwrite runs
        in the same transaction and deletes no version. No change is merged
        lesson by lesson.
      - Before a carried change is saved, the screen lists the lesson rows
        the overwrite replaces where the planned version differed from the
        version in force, so that nothing planned is lost unseen. Where there
        are none, the screen only asks.
      - With more than one planned version ahead, each is named with its start
        date and handled the same way.
- [ ] There is no «скасувати запланований розклад». A planned version is
      changed the way any version is changed. Its days change through the day
      save. Its range changes by planning another version from a date, and a
      version planned from the same date replaces it (`replace`). No version
      is deleted and no `validTo` moves forward (fixtures §3.8), so a change
      of mind costs the teacher re-entering the lessons. The decision and why
      the alternatives were rejected are in overview §10.8.
- [ ] The editor edits the version in force on a date D, which the URL
      carries as it carries the view, the parity week and the day. D
      defaults to today, which is the editor as it is now. The editor reads
      and saves the version in force on D, and its saves start on D. D is
      never before today, so a version that has ended stays listed and read
      only.
      - Above the grid there is a tab for the version in force today and one
        for each planned version, each with its start date. A planned
        version's tab sets D to its start, so a save there edits it (the
        «D equal to S» case above).
      - «Новий розклад з…» sets D to the chosen date.
      - The heading always says which version is being edited, for example
        «Ви редагуєте розклад, що почне діяти 02.11».
      - An integration test opens a planned version's tab, changes a Monday,
        and saves. The change shows in the calendar from the planned start,
        and the version in force today is unchanged.
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
