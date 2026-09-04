# Year setup — the writable frame

**Ticket:** `docs/backlog/T-009-year-setup-screens.md`
**Status:** authoritative for T-009.

Rationale lives in `docs/architecture/architect-overview.md` §2, §3.5, §4, §8.1,
§8.2 and §8.4, and in `ADR-004` and `ADR-005`. This document adds no reasoning:
it states the mechanics — the modules, the field names each form submits, what
every action does in order, which rule is checked where, and the constraint
names the screen turns into Ukrainian.

This is the first writable screen in the application. Everything before it read;
`lib/actions` held sign-in and sign-out alone.

---

## 1. Modules

### Validation — one schema per form (overview §8.2)

| File | Exports |
|---|---|
| `lib/validation/fields.ts` | `isoDateField()`, `optionalIsoDateField`, `clockTimeField`, `nameField`, `isOrderedRange()`, `DATE_RANGE_RULE` |
| `lib/validation/enums.ts` | `PARITY_VALUES`, `WEEKDAY_VALUES`, `NON_TEACHING_KIND_VALUES`, `BOUNDARY_KIND_VALUES`, `LESSON_NUMBERS`, `SEMESTER_INDEXES` |
| `lib/validation/formState.ts` | `FormState`, `EMPTY_FORM_STATE`, `invalidInput()`, `rejected()`, `rejectedField()`, `submittedValues()` |
| `lib/validation/academicYear.ts` | `academicYearInput`, `ACADEMIC_YEAR_FIELD` |
| `lib/validation/semester.ts` | `semesterInput`, `SEMESTER_FIELD` |
| `lib/validation/nonTeachingPeriod.ts` | `nonTeachingPeriodInput`, `NON_TEACHING_PERIOD_FIELD` |
| `lib/validation/weekdayRule.ts` | `weekdayRuleInput`, `WEEKDAY_RULE_FIELD` |
| `lib/validation/bellSchedule.ts` | `bellScheduleInput`, `bellField()`, `bellFieldErrors()` |
| `lib/validation/parityAnchor.ts` | `parityAnchorInput`, `PARITY_ANCHOR_FIELD` |

`enums.ts` transcribes the four `pgEnum`s rather than importing them, so the
Drizzle schema does not reach the client bundle; `enums.test.ts` asserts each
tuple equals its `pgEnum`, order included.

Each `*_FIELD` map is declared `as const satisfies Record<keyof <Input>, string>`:
the form writes `name={X_FIELD.dateFrom}`, so renaming a schema key without
renaming it in the form fails the type check.

### Reads (read-only, `userId` first — overview §8.4)

| File | Exports |
|---|---|
| `lib/db/queries/yearSetup.ts` | `listAcademicYears()`, `getAcademicYear()`, `listSemesters()`, `listNonTeachingPeriods()`, `listWeekdayRules()`, `getWeekdayRule()`, `listParityAnchors()` |
| `lib/db/constraintViolation.ts` | `violatedConstraint()`, `constraintMessage()` |

`lib/db/queries/bells.ts::getBellSchedule()` is reused unchanged.

These are separate from T-008's reads rather than shared with them: the calendar
reads what `expand()` consumes, a setup row needs its `id` and the
`boundaryKind` the domain must not look at.

### Writes — Server Action → Drizzle, no query layer (overview §2)

| File | Exports |
|---|---|
| `lib/actions/yearSetup.ts` | `YEAR_SETUP_PATH`, `SAVE_REFUSED`, `YEAR_NOT_FOUND`, `OUTSIDE_THE_YEAR` — constants only, **no `"use server"`** |
| `lib/actions/academicYear.ts` | `createAcademicYearAction`, `updateAcademicYearAction`, `deleteAcademicYearAction` |
| `lib/actions/semesters.ts` | `createSemesterAction`, `updateSemesterAction`, `deleteSemesterAction` |
| `lib/actions/nonTeachingPeriods.ts` | `createNonTeachingPeriodAction`, `updateNonTeachingPeriodAction`, `deleteNonTeachingPeriodAction` |
| `lib/actions/weekdayRules.ts` | `createWeekdayRuleAction`, `updateWeekdayRuleAction`, `deleteWeekdayRuleAction` |
| `lib/actions/bellSchedule.ts` | `saveBellScheduleAction` |
| `lib/actions/parityAnchors.ts` | `createParityAnchorAction`, `deleteParityAnchorAction` |

`yearSetup.ts` carries no directive because a `"use server"` module may export
nothing but async functions, and every exported *function* under `lib/actions`
must reach `requireUser()` (`lib/auth/queryDiscipline.test.ts`).

### Screen

| File | Exports |
|---|---|
| `components/forms/form-field.tsx` | `FormField` — label, control, `aria-invalid`, `aria-describedby` |
| `components/forms/form-message.tsx` | `FormMessage` — the `role="alert"` line for `FormState.error` |
| `components/forms/date-field.tsx` | `DateField` |
| `components/forms/submit-button.tsx` | `SubmitButton` |
| `components/forms/delete-button.tsx` | `DeleteButton` |
| `components/forms/values.ts` | `fieldValue()` |
| `components/ui/input.tsx`, `components/ui/select.tsx` | `Input`, `Select` (a native `<select>`) |
| `components/year/labels.ts` | every Ukrainian string and every option list the screen shows |
| `components/year/selection.ts` | `pickYear()` |
| `components/year/section.tsx` | `Section`, `Row`, `Empty` |
| `components/year/year-form.tsx`, `year-switcher.tsx`, `semesters-section.tsx`, `periods-section.tsx`, `rules-section.tsx`, `bells-section.tsx`, `parity-section.tsx` | the six sections |
| `app/(app)/(schedule)/year/page.tsx` | the screen |

`app/(auth)/sign-in/sign-in-form.tsx` moves onto `FormField`, `FormMessage`,
`SubmitButton` and `Input`; its behaviour is unchanged.

## 2. URL

```
/year               the year covering today, else the next to start, else the last
/year?year=<uuid>   that year, when it is one of this teacher's
```

`pickYear()` (`components/year/selection.ts`) is the whole rule, in that order.
An id that is not the teacher's falls through to the same defaults — the list it
is looked up in is `listAcademicYears(userId)`.

## 3. Field names, per form

| Form | Fields (`name=`) | Action |
|---|---|---|
| year | `dateFrom`, `dateTo`, `initialParity` | `create`/`updateAcademicYearAction` |
| semester | `index`, `dateFrom`, `dateTo` | `create`/`updateSemesterAction` |
| period | `kind`, `name`, `dateFrom`, `dateTo` | `create`/`updateNonTeachingPeriodAction` |
| weekday rule | `weekday`, `boundaryKind`, `lastDay` | `create`/`updateWeekdayRuleAction` |
| bells | `bell-<0…9>-from`, `bell-<0…9>-to` | `saveBellScheduleAction` |
| parity reset | `date`, `parity` | `createParityAnchorAction` |

Ids are passed by `Function.prototype.bind`, never as hidden inputs, and never
`userId` — that one comes from `requireUser()` alone (overview §8.4).

## 4. What each action does, in order

Every one: `requireUser()` → parse → (read the year, where a rule needs it) →
write → `revalidatePath("/year")`. `createAcademicYearAction` also
`redirect()`s to the new year; the redirect is outside the `try`, because
`redirect()` signals by throwing.

**`createAcademicYearAction` / `updateAcademicYearAction`.** One transaction
writes `academic_year` and the `parity_anchor` on `date_from` — «рік
починається з чисельника» is that anchor and no column (schema §4.1, F-1). The
anchor is written with `ON CONFLICT (user_id, date) DO UPDATE`, so a reset the
teacher already entered on that date becomes the initial value instead of an
error. On update, a changed `date_from` deletes the anchor on the old first day
before writing the new one: the initial value *is* the anchor on the year's
first day, so it moves with it. Resets on other dates are untouched.

An update that **narrows** the year is refused when it would leave an anchor or
a rule outside the new dates (`strandedByNarrowing()`): those rows are shown
under the year whose dates reach them, so shrinking the year would push them off
every screen while the calendar goes on reading them. The teacher removes the
row first; shrinking a year never deletes what was entered under it.

**`deleteAcademicYearAction`.** `semester` and `non_teaching_period` cascade
(schema §8). `parity_anchor` and `non_teaching_weekday_rule` have no
`academic_year_id`, so they are deleted here **by the predicates the screen
listed them under** — an anchor with `date` in `[date_from, date_to]`, a rule
with `valid_from <= date_to` and `boundary_date > date_from`. What the teacher
saw under this year goes with it; a narrower condition leaves rows nothing can
reach and the calendar still reads.

**`saveBellScheduleAction`.** Reads all ten numbers whether or not they were
filled in, deletes the rows for the cleared ones and upserts the rest through
`bell_schedule_user_number_uq` (`excluded.time_from` / `excluded.time_to`). One
submission therefore creates, updates and deletes.

**`createWeekdayRuleAction` / `updateWeekdayRuleAction`.** The one place
overview §8.1 happens:

```
validFrom    = create: ruleValidFrom(year.dateFrom, today())   ← ADR-004
               update: the row's existing valid_from
boundaryDate = resolveBoundary({ kind: boundaryKind,
                                 referenceDate: validFrom,
                                 lastDay,
                                 breaks:    periods where kind = 'BREAK',
                                 semesters: the year's, in index order })
```

`undefined` is not an error but a question: `NEXT_BREAK` with no break after
`validFrom`, `END_OF_SEMESTER` with no semester still running, or a `lastDay`
that has already passed. Each returns a message on the field that has to change
(`boundaryKind`, or `lastDay` for `DATE`).

A year that has already ended is refused before any of that: `validFrom` is
today once the year has started, so `validFrom > year.dateTo` would write a rule
that no year's screen lists and the calendar still applies.

The resolved `boundaryDate` is then checked against the other end of the year:
`boundaryDate <= nextIsoDate(year.dateTo)`, exclusive against inclusive. Only a
`DATE` can fail it — `NEXT_BREAK` and `END_OF_SEMESTER` resolve against the
year's own breaks and semesters — so in practice it catches a mistyped
`lastDay`. It is the mirror of the check above and exists for the same reason:
`listWeekdayRules()` selects by overlap, so a rule reaching past the year's last
day is listed under **two** years, and `deleteAcademicYearAction` on either one
deletes it, un-blanking a weekday in a year the teacher never touched.

**`createParityAnchorAction`.** Refuses a date equal to `year.dateFrom` — that
row belongs to the year form — and a date outside the year.

## 5. Which rule is checked where

| Rule | Where | Why not elsewhere |
|---|---|---|
| shape, required fields, `dateFrom <= dateTo`, `timeFrom < timeTo`, `HH:MM`, `DATE` needs a `lastDay` | the Zod schema | it is the boundary the browser and the action share |
| a child range inside its year | the action | needs the year row; no constraint expresses it |
| an UPDATE that matched no row (deleted in another tab) | the action, via `.returning()` | Drizzle reports success for an UPDATE that matched nothing. In `updateAcademicYearAction` the empty result **throws** (`YearVanished`) rather than returning: the anchor upsert in the same transaction has no `academic_year_id` to cascade from, so it has to roll back with the year |
| a year narrowed past a row that hangs off it | the action | needs both the old and the new range |
| two years / two semesters overlapping | `*_no_overlap_ex` | checking it in the action is a race: two submissions can both read "no overlap" and both insert |
| a year's second semester 1 | `semester_year_index_uq` | same race |
| an anchor already on that date | `parity_anchor_user_date_uq` | same race |

## 6. Constraint → message

`lib/db/constraintViolation.ts` reads `code` (PostgreSQL class 23) and
`constraint_name` off the driver's error, walking `cause` in case a future
Drizzle release wraps it. Each action maps the names it can produce; anything
else in class 23 falls back to `SAVE_REFUSED`, and anything outside it is
rethrown.

| Constraint | Message |
|---|---|
| `academic_year_no_overlap_ex` | Ці дати перетинаються з іншим навчальним роком |
| `academic_year_dates_ck` | Рік не може завершуватися раніше, ніж починається |
| `semester_year_index_uq` | Такий семестр у цьому році вже є |
| `semester_no_overlap_ex` | Ці дати перетинаються з іншим семестром |
| `semester_dates_ck` | Семестр не може завершуватися раніше, ніж починається |
| `non_teaching_period_dates_ck` | Період не може завершуватися раніше, ніж починається |
| `ntwr_range_ck` | Правило має діяти хоча б один день |
| `bell_schedule_times_ck` | Урок не може завершуватися раніше, ніж починається |
| `bell_schedule_number_ck` | Уроки нумеруються від 0 до 9 |
| `parity_anchor_user_date_uq` | Точка відліку на цю дату вже є |
| anything else in class 23 | Не вдалося зберегти: дані суперечать іншим записам |

## 7. What the teacher sees of a boundary

Stored: `boundary_date`, **exclusive**. Shown: the `boundaryKind` as a word, and
`boundary_date − 1 day` as «Діє до». Typed: the same inclusive last day, which
`resolveBoundary()` turns back into the exclusive bound. Every date a teacher
sees or types is inclusive; only the stored bound is not (schema §6).

## 8. What this ticket deliberately leaves out

- **No re-resolution when a break moves.** Overview §8.1 records it as an
  accepted cost; the period edit form carries the warning and nothing chases the
  rules.
- **No dedupe of overlapping weekday rules.** Overlapping rows are an OR and
  change no answer, so the section lists them as they are. Schema §4.4 said the
  UI would collapse them; it has been corrected to say what is true.
- **No edit form for a parity reset.** A reset is a date and one of two values;
  removing and adding is the same number of gestures.
- **No semesters generated from the year's dates**, and no holiday import.
- **Delete confirmation needs JavaScript.** Everything else on the screen works
  without it; with JavaScript off a delete goes straight through.
