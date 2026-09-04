# Day overrides — editing one lesson of one date

**Ticket:** `docs/backlog/T-011-day-override-editing.md`
**Status:** authoritative for T-011.

Rationale lives in `docs/architecture/architect-overview.md` §3.4 and §5, and in
`decisions/ADR-008-calendar-edits-have-their-own-route.md`. This document adds no
reasoning: it states the mechanics — the URL, the modules, the three writes and
what each screen state is computed from.

---

## 1. Modules

| File | Exports / change |
|---|---|
| `lib/validation/slotFields.ts` | **new**, extracted from `templateDay.ts`: `SLOT_FIELDS`, `SlotFieldName`, `MAX_SLOT_LENGTH`, `rawSlotFields`, `isBlankSlot()`, `checkSlotFields()`, `toSlotPayload()` |
| `lib/validation/templateDay.ts` | now consumes `slotFields.ts`; `TEMPLATE_SLOT_FIELDS` and `TemplateSlotFieldName` are aliases of it. No behaviour change |
| `lib/validation/dayOverride.ts` | **new**: `EDITABLE_OVERRIDE_KINDS`, `DAY_OVERRIDE_FIELD`, `dayOverrideInputFor()`, `readDayOverride()`, `parseLessonNumber()` |
| `lib/db/queries/overrides.ts` | gains `getDayOverride(userId, date, view, lessonNumber)` |
| `lib/actions/calendar.ts` | **new**, constants only (no `"use server"`): `CALENDAR_PATH`, `SAVE_REFUSED`, `OVERRIDE_NOT_FOUND` |
| `lib/actions/dayOverride.ts` | **new**: `saveDayOverrideAction()`, `clearLessonAction()`, `removeDayOverrideAction()` |
| `lib/domain/calendar/days.ts` | gains `buildPlannedDays()` — the override-free expansion `buildCalendarDays()` already computed internally |
| `components/forms/slot-labels.ts` | **new**: `SLOT_FIELD_LABELS`, `slotFieldLabel()` — moved out of `components/schedule/labels.ts`, now shared by both screens that write a lesson |
| `components/calendar/links.ts` | gains `lessonHref()` |
| `components/calendar/lessonNumbers.ts` | **new**: `addableLessonNumbers()` |
| `components/calendar/labels.ts` | gains `EDIT_LABELS`, `OVERRIDE_LABELS`, `REMOVE_OVERRIDE_LABELS`, `OVERRIDE_KIND_OPTIONS` |
| `components/calendar/override-form.tsx` | **new**, client: the payload form |
| `components/calendar/override-actions.tsx` | **new**, client: `ClearLessonForm`, `RemoveOverrideForm` |
| `components/calendar/{lesson-row,day-lessons,day-card,views}.tsx` | thread an optional `DayEditing` down to the row |
| `app/(app)/(calendar)/calendar/[view]/[date]/lesson/[lessonNumber]/page.tsx` | **new**: the screen |

## 2. URL

```
/calendar/<view>/<date>/lesson/<n>[?schedule=class]
```

The four segments are exactly the row `day_override_slot_uq` holds — `date`,
`view` (from `?schedule=`), `lesson_number` — plus `<view>`, the *calendar* view
the teacher came from, which only decides where «Повернутися» goes.

`notFound()` for a segment that is not a calendar view, not a real date
(`2026-02-30`), or not a lesson number. `parseLessonNumber()` accepts the ten
canonical spellings `0`…`9` and nothing else: `01`, `1.0` and `1e0` are refused
so that one lesson has one URL, and `10` is outside `day_override_number_ck`.

Reached from the day and week views only — a `LessonRow` gains a «Змінити» link
and the day gains «Додати урок: + N» for every bell number it does not already
show (`addableLessonNumbers()`). The month and year cells are unchanged; their
day number opens the day.

## 3. What the screen computes

| Shown | From |
|---|---|
| what the calendar shows now | `buildCalendarDays()` → `day.lessons` / `day.cancelled` at `n` |
| what the weekly template gives | `buildPlannedDays()` → `lessons` at `n` |
| whether an override is in force, and its kind | `getDayOverride()` |

The third read cannot come from the expansion: a `CLEARED` row over a slot the
template does not fill and no row at all resolve to the same empty day
(`expand-fixtures.md` §8.8, O8), and the editor must offer «Повернути урок» for
one and not for the other.

`buildPlannedDays()` is what a `SUBSTITUTION` will show beside itself — the same
value `expand()` puts in `replacedOriginal`, recomputed from the version and the
parity in force on the date (§8.4, pinned on 2026-11-05 as `Математика · 5-В`)
— and what removing an override restores.

State table, for `n` on one date:

| `getDayOverride()` | `day.lessons` | `day.cancelled` | Screen |
|---|---|---|---|
| `null` | the template's lesson | — | form prefilled from the planned lesson; «Скасувати урок» |
| `EDIT` / `SUBSTITUTION` | the override's lesson | — | form prefilled from the stored payload; «Скасувати урок»; «Прибрати правку» / «Прибрати заміну» |
| `CLEARED` | — | the planned lesson | form prefilled from the planned lesson; «Повернути урок». No «Скасувати урок»: there is nothing left to cancel |
| `null`, no slot | — | — | empty form; no «Скасувати урок» — a tombstone over nothing is a no-op (§8.8) |

## 4. The three writes

All three are Server Actions in `lib/actions/dayOverride.ts`. Each calls
`requireUser()` first and filters every statement by its result; the slot is
bound by the screen from the URL and never read from the form (overview §8.4).

| Action | SQL | Effect |
|---|---|---|
| `saveDayOverrideAction` | `INSERT … ON CONFLICT (user_id, date, view, lesson_number) DO UPDATE` | writes `EDIT` or `SUBSTITUTION` with the parsed payload |
| `clearLessonAction` | the same upsert | writes `CLEARED` with `payload = NULL` — a tombstone, never a delete |
| `removeDayOverrideAction` | `DELETE … RETURNING id` | the template applies to the date again; an empty `RETURNING` answers `OVERRIDE_NOT_FOUND` |

**No copy-on-write, and no version.** A `DayOverride` is bound to a date and
already survives a template change (overview §3.4, schema §4.9), so there is no
history for a new version to protect — the contrast with
`lib/actions/scheduleTemplate.ts` is deliberate and is the reason ADR-006's
invariants are not repeated here.

**Last write wins.** Two windows on one slot resolve by `ON CONFLICT`, not by a
read-then-write that would race into a unique violation the teacher can do
nothing with.

Each action revalidates `CALENDAR_PATH` with `"layout"`: one override appears in
four views at four different URLs.

## 5. Validation

`dayOverrideInputFor(view)` is the Zod boundary (overview §3.3). It parses the
five raw fields and the `kind`, and yields `{ kind, payload }`; the **parsed**
payload is stored, so unknown keys never reach the `jsonb` (schema §7).

- the fields, their limits and their messages are `slotFields.ts`, shared with
  the template editor — an override *is* a lesson (overview §3.4);
- `kind` accepts `EDIT` and `SUBSTITUTION` only. `CLEARED` carries no payload at
  all, so it is written by its own action and cannot arrive through this form;
- an all-blank submission is **refused**, on `subject`. This is where the
  override differs from a template day, whose empty row means «delete the slot»
  (schema §4.8): here, deleting is «Прибрати правку» and cancelling is
  «Скасувати урок», and an empty payload is a third state the model has no room
  for.

## 6. Tests

| Suite | What it pins |
|---|---|
| `lib/validation/dayOverride.test.ts` | the payload per view, absent optional keys (§8.8), the refusals, the two kinds, `parseLessonNumber()` |
| `lib/domain/calendar/days.test.ts` | `buildPlannedDays()` on 10-13, 11-05 (equals the pinned `replacedOriginal`), 10-19 (equals `cancelled`), 10-17 (non-teaching gives nothing) |
| `components/calendar/lessonNumbers.test.ts` | which numbers «додати урок» offers |
| `components/calendar/links.test.ts` | `lessonHref()`, and that `CLASS` survives the link |
| `components/calendar/labels.test.ts` | the §5.4 hint, and a removal label for every kind |
| `components/forms/slot-labels.test.ts` | a label for every field of both views |
| `lib/db/queries/overrides.integration.test.ts` | the three states, the parsed payload, another teacher's rows |

Every expectation is read off `expand-fixtures.md` or the specification; none was
obtained by running the code.

## 7. What this ticket deliberately leaves out

- **Moving a lesson to another number** — that is a delete and an insert at two
  slots, and no acceptance criterion asks for it.
- **Cancelling a whole day at once** — seven presses is the honest cost until a
  teacher asks otherwise.
- **Events** (§6.3) — T-012.
- **A warning when a template change moves a `replacedOriginal`.** The screen
  says the value follows the schedule in force (`OVERRIDE_LABELS`
  `substitutionHint`); chasing the overrides affected by a template save is not
  in the model and is not wanted (overview §3.4: accepted behaviour).
