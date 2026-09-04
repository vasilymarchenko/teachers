# Weekly template editor — modules and the write path

**Ticket:** `docs/backlog/T-010-weekly-template-editor.md`
**Status:** authoritative for T-010.

Rationale lives in `docs/architecture/architect-overview.md` §3.2, §3.3, §8.1
and §10.2, and in `ADR-006`. This document adds no reasoning: it states the
mechanics — the modules, the field names the forms submit, the order of the
writes in the one transaction, and what each branch of the plan does.

This is the first screen that writes `schedule_template`. Everything about
copy-on-write before it was `planTemplateEdit()` and the constraints
(`schema.md` §4.7), with no caller.

---

## 1. Modules

### Domain — pure, no database (overview §2)

| File | Exports |
|---|---|
| `lib/domain/schedule/templateSlots.ts` | `replaceDaySlots()`, `copyParity()`, `SlotCell` |
| `lib/domain/schedule/copyOnWrite.ts` | `planTemplateEdit()` (T-005), `capToNextVersion()` (added here) |

Both `templateSlots.ts` functions take the **whole** slot set of the version in
force and return the set the new version will hold. They are the only thing that
differs between the screen's three writes.

### Validation — one schema per form (overview §8.2)

| File | Exports |
|---|---|
| `lib/validation/templateDay.ts` | `templateDayInputFor(view)`, `readTemplateDay()`, `templateDayFieldErrors()`, `templateSlotField()`, `TEMPLATE_SLOT_FIELDS` |
| `lib/validation/templateBoundary.ts` | `templateBoundaryInput`, `TEMPLATE_BOUNDARY_FIELD` |
| `lib/validation/enums.ts` | `SCHEDULE_VIEW_VALUES` added to the existing tuples |

`templateDayInputFor()` is a function of the `view` because the fields are:
`OWN` has `subject`, `className`; `CLASS` has `subject`, `teacherName`,
`zoomLink`, `note` (specification §5.1). The transform produces exactly the
payload `slotPayloadFor(view)` defines, and `templateDay.test.ts` parses every
payload it produces through that schema — that assertion is what keeps the two
in step without a second runtime parse.

Field names are computed, not listed: `slot-<lessonNumber>-<field>`. The rows
are the lesson numbers the screen showed, so `readTemplateDay()` and
`templateDayFieldErrors()` both take that list and read a lesson number off an
array index — the same pairing `bellField()` / `bellFieldErrors()` has.

### Reads — `lib/db/queries/templateEditor.ts` (read-only, `userId` first)

| Function | Returns |
|---|---|
| `getTemplateVersionInForce(userId, view, date)` | the version covering `date` with its slots, or `null` |
| `getNextTemplateVersionStart(userId, view, date)` | the earliest `valid_from` after `date`, or `undefined` |
| `listTemplateVersions(userId, view)` | every version of the view, oldest first |

Separate from T-008's `getTemplateVersions()`: that one feeds `expand()` and
carries no `id` and no `boundary_kind`, which an editing screen needs and the
domain must not see.

### Writes — `lib/actions/scheduleTemplate.ts`

| Action | Bound arguments |
|---|---|
| `saveTemplateDayAction` | `view`, `parity`, `weekday`, `lessonNumbers` |
| `copyParityAction` | `view`, `from`, `to` |
| `setTemplateBoundaryAction` | `view` |

All three call the module-private `applyTemplateEdit()`. `lib/actions/schedule.ts`
holds the constants and carries no `"use server"` directive, for the reason
`yearSetup.ts` states.

### Screen — `app/(app)/(schedule)/schedule/page.tsx`, `components/schedule/`

| File | What it is |
|---|---|
| `labels.ts` | every Ukrainian word; re-exports the ones the calendar and the year setup already own |
| `selection.ts` | `pickTemplateSelection()`, `templateHref()` — the `?view=&parity=&day=` switches |
| `lessonRows.ts` | `lessonRows()` — which lesson numbers are rows |
| `day-form.tsx` | one day: the unit of saving |
| `week-grid.tsx` | seven `DayForm`s |
| `switchers.tsx`, `boundary-form.tsx`, `copy-parity-form.tsx`, `version-notice.tsx` | the controls around the grid |

`FormField` gained a `labelHidden` prop for the grid's cells: the label is kept
for a screen reader and taken off the screen.

---

## 2. The write path

One function, three callers. `mutate` is the only thing that varies.

```
applyTemplateEdit(userId, view, mutate, formData, choice?)

 1. cutAt   = today()                                   ← never from a form (I1)
 2. current = getTemplateVersionInForce(userId, view, cutAt)      ┐ in parallel
    next    = getNextTemplateVersionStart(userId, view, cutAt)    ┘
 3. boundary = boundaryFor(...)          ← §3 below
 4. validTo  = capToNextVersion(boundary.validTo, next)
 5. plan     = planTemplateEdit({ current, validTo })
 6. slots    = mutate(current?.slots ?? [])
 7. one transaction, in this order:
        plan.trim    → UPDATE schedule_template SET valid_to = cutAt WHERE id, user_id
                       … 0 rows matched → roll back, answer VERSION_CHANGED
        plan.replace → DELETE schedule_template WHERE id, user_id   (slots cascade)
                       … 0 rows matched → roll back, answer VERSION_CHANGED
        always       → INSERT schedule_template (valid_from = cutAt, valid_to, boundary_kind)
        slots ≠ ∅    → INSERT template_slot × n
 8. revalidatePath("/schedule")
```

The trim happens **before** the insert so the two never overlap, not even for
the length of a statement — `schema.md` §4.7 states the same order.

`plan.replace` is `DELETE` + `INSERT` rather than an `UPDATE` of the version's
slots. The outcome is the one §4.7 describes — one version, the same range,
different slots — and this shape keeps step 7 to a single way of writing slots.

### The three `mutate`s

| Action | `mutate` |
|---|---|
| day | `replaceDaySlots(slots, { weekday, parity }, submitted)` |
| copy | `copyParity(slots, from, to)` |
| boundary | `(slots) => [...slots]` |

---

## 3. Where `valid_to` comes from

`boundaryFor()`, in this order:

1. **the teacher named one** («доки діє» was submitted) → `resolveBoundary()`
   against `cutAt`;
2. **a version is in force** → its `valid_to` and `boundary_kind` verbatim. Not
   re-resolved: overview §8.1 forbids resolving a symbol at any time but the
   write, so the stored pair moves across as it stands;
3. **neither** → `END_OF_SEMESTER`, the default of specification §5.1, resolved
   now.

`DATE` needs no rows. `NEXT_BREAK` and `END_OF_SEMESTER` resolve against
`getYearFrame(userId, cutAt)` (semesters) and `listNonTeachingPeriods()`
filtered to `kind = 'BREAK'`. No year covering today → the save is refused with
`NO_YEAR`; a symbol that resolves to nothing → a message on the field that has
to change, as `weekdayRules.ts` does it.

There is no "inside the year" check, unlike `non_teaching_weekday_rule`: a
`schedule_template` row is found by date overlap alone and belongs to no year,
so a version reaching past the year's last day is a schedule that keeps
applying, not a row listed under two years.

`capToNextVersion()` then caps the result at the next version's `valid_from`.
Without it «до кінця семестру» chosen while a later version exists produces an
overlap, and the teacher gets I3's refusal instead of a schedule.

---

## 4. Constraint names the screen turns into Ukrainian

| Constraint | Message |
|---|---|
| `schedule_template_no_overlap_ex` | «Розклад щойно змінили в іншому вікні. Оновіть сторінку й повторіть» |
| `schedule_template_range_ck` | «Розклад має діяти хоча б один день» |
| `template_slot_number_ck` | «Уроки нумеруються від 0 до 9» |
| anything else in class 23 | `SAVE_REFUSED` |

An `UPDATE` or `DELETE` that matched no rows produces the same message as the
exclusion constraint, and by the same reasoning: the version this edit was
planned against is not the one in the database any more.

---

## 5. Rows, and what the screen shows

`lessonRows(bells, slots)` = the bell rows ∪ the lesson numbers that already
have a slot, ordered by number, **gaps kept**. Bells on 1, 2 and 5 give rows 1,
2 and 5. A slot whose bell row was deleted is still shown, without a time —
otherwise a lesson in the template and in the calendar would be unreachable from
the editor.

The rows are computed from every slot of the version, not from the day being
edited, so the seven day cards line up on the same rows.

No bells and no slots → the screen is an empty state pointing at `/year`.

The layout is one day below `md` (selected by `?day=`) and all seven from `md`
up; all seven are always rendered and six are hidden with CSS, which is what
keeps the day switcher a set of plain links.

---

## 6. What the teacher is told about versions

`VersionNotice` is rendered from `listTemplateVersions()` and `today()`:

- **the version in force**, with its dates and the symbol it was entered under;
- **the I2 warning**, before the save and naming **two** dates — the day the
  schedule in force will now end on and the day it was going to end on. It is
  said before, because after the trim the original `valid_to` is stored nowhere
  and cannot be named;
- **«почав діяти сьогодні»** instead of that warning when `valid_from = today`:
  nothing is being frozen, the edit lands in that version;
- **the versions that have ended**, listed — «історія не переписується» is a
  claim the screen can show rather than assert;
- **a later version**, if there is one, and the cap it puts on the new one;
- **the line about a past day**, pointing at the calendar (specification §5.3).

Backdating is not offered anywhere on the screen: no form takes a start date,
and `applyTemplateEdit()` takes no cut date to give one to.
