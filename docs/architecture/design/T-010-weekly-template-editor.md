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
| `lib/domain/schedule/templateSlots.ts` | `replaceDaySlots()`, `saveDaySlots()` (T-043), `copyParity()`, `otherParity()`, `SlotCell` |
| `lib/domain/schedule/copyOnWrite.ts` | `planTemplateEdit()` (T-005), `capToNextVersion()` and `TemplateBoundary` (added here) |

The slot-set functions of `templateSlots.ts` take the **whole** slot set of the
version in force and return the set the new version will hold; the `mutate`
each write passes (§2) is the only thing that differs between the screen's
three writes.

`replaceDaySlots()` takes a fourth argument, `covered` — the lesson numbers the
form rendered. It replaces the day only at those numbers: an empty input is the
teacher clearing a cell, but a number the form never showed has no input to be
empty, and a slot there (added in another window, or left behind by a deleted
bell row) is carried into the new version rather than deleted.

`saveDaySlots(slots, cell, next, covered, bothWeeks, same)` (T-043, ADR-025) is
the day save: `replaceDaySlots()` for `cell`, then `replaceDaySlots()` again for
the same weekday of `otherParity(cell.parity)`, limited to `bothWeeks ∩
covered` and with `next`'s slots at those numbers re-keyed to the other parity
— so a row switched on and emptied is removed there too, and every other slot
of the other week is carried through. It returns `{ slots, changedInOther }`:
the numbers of `bothWeeks ∩ covered` whose other-week payload was not `same`
as the one written. `same` is passed in because the payload is opaque in the
domain; the action passes `sameLesson(view, …)` from
`lib/validation/slotFields.ts`, which compares the view's fields after the
`rawSlotFields` trimming a save applies.

### Validation — one schema per form (overview §8.2)

| File | Exports |
|---|---|
| `lib/validation/templateDay.ts` | `templateDayInputFor(view)`, `readTemplateDay()`, `templateDayFieldErrors()`, `templateSlotField()`, `TEMPLATE_SLOT_FIELDS`; `templateBothWeeksField()`, `readTemplateBothWeeks()`, `echoBothWeeks()` (T-043) |
| `lib/validation/slotFields.ts` | `sameLesson(view, a, b)` (T-043) beside the shared lesson fields |
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

`lib/db/queries/suggestions.ts` (T-044) holds `getLessonSuggestions(userId)` —
the distinct trimmed `subject`, `className` (`OWN`) and `teacherName` (`CLASS`)
of every `template_slot` and `day_override` payload, every version and every
date, sorted by `collectSuggestions()` in `lib/domain/schedule/suggestions.ts`
(`Intl.Collator("uk", { numeric: true })`, so «8-А» sorts before «10-А»). The
sort runs in the application, not as `ORDER BY … COLLATE` in the query: a
Postgres ICU collation exists only if the `postgres` image ships it, and the
order would then depend on the image rather than on the code. The page reads
it once.

`lib/db/queries/yearFrame.ts` gains `getUpcomingYearFrame(userId, date)` — the
earliest year beginning after `date`, same shape as `getYearFrame()`. §3 below
is the only caller and says why.

### Writes — `lib/actions/scheduleTemplate.ts`

| Action | Bound arguments |
|---|---|
| `saveTemplateDayAction` | `view`, `parity`, `weekday`, `lessonNumbers`; its one submitted input beyond the rows is the `both-<lessonNumber>` checkboxes (T-043) |
| `copyParityAction` | `view`, `from`, `to` |
| `setTemplateBoundaryAction` | `view` |

All three call the module-private `applyTemplateEdit()`. `lib/actions/schedule.ts`
holds the constants and carries no `"use server"` directive, for the reason
`yearSetup.ts` states.

### Screen — `app/(app)/(schedule)/schedule/page.tsx`, `components/schedule/`

| File | What it is |
|---|---|
| `labels.ts` | every Ukrainian word of this screen; re-exports the ones the calendar and the year setup already own. The words for a lesson's own fields moved to `components/forms/slot-labels.ts` in T-011, shared with the override editor |
| `selection.ts` | `pickTemplateSelection()`, `templateHref()` — the `?view=&parity=&day=` switches |
| `lessonRows.ts` | `lessonRows()` — which lesson numbers are rows |
| `day-form.tsx` | one day: the unit of saving. Its `subject`, `className` and `teacherName` inputs carry `list={suggestionListFor(field)}` (T-044). Each row's header renders `RowActions` (T-046) |
| `row-actions.tsx` | `RowActions` — the icon at the end of a row's header that clears the row or undoes the clear (T-046) |
| `rowClear.ts` | `rowLessonFields()`, `rowHasLesson()`, `rowClearReducer()`, `rowIcon()` — the row's clear/undo state, until the save (T-046) |
| `both-weeks-toggle.tsx` | `BothWeeksToggle` — the row's «в обох тижнях» checkbox, drawn as an icon (T-043) |
| `bothWeeks.ts` | `rowLine()`, `shownLine()`, `untrackedToggles()` — the row's line of text and the toggles T-047 leaves out (T-043) |
| `week-grid.tsx` | seven `DayForm`s |
| `switchers.tsx`, `boundary-form.tsx`, `copy-parity-form.tsx`, `version-notice.tsx` | the controls around the grid |

`components/forms/suggestions.tsx` (T-044): `SuggestionLists`, the three
native `<datalist>`s the page renders once beside the seven forms, and
`suggestionListFor()`, which gives `zoomLink` and `note` no list.

`FormField` gained a `labelHidden` prop for the grid's cells: the label is kept
for a screen reader and taken off the screen.

`day-form.tsx` and `boundary-form.tsx` render through `TrackedForm` (T-047):
their «Зберегти» is available only while the form holds something to save,
and `BoundaryForm` opens as changed when the page's `restatedUntil` says the
stored symbol now resolves elsewhere. The convention — which forms opt in,
what "changed" means, a field left out of it, and the contract for a value set
from code — is `architect-overview.md` §8.2; the mechanics are
`design/T-047-save-when-changed.md`.

---

## 2. The write path

One function, three callers. `mutate` is the only thing that varies.

```
applyTemplateEdit(userId, view, mutate, formData, choice?)

 1. now     = new Date();  cutAt = today(now)           ← never from a form (I1)
 2. current = getTemplateVersionInForce(userId, view, cutAt)      ┐ in parallel
    next    = getNextTemplateVersionStart(userId, view, cutAt)    ┘
 3. boundary = boundaryFor(...)          ← §3 below
 4. capped   = capToNextVersion(boundary, next)      ← the pair; a cap ⇒ DATE
 5. plan     = planTemplateEdit({ current, validTo: capped.validTo, now })
 6. slots    = mutate(current?.slots ?? [])
 7. one transaction, in this order:
        plan.trim    → UPDATE schedule_template SET valid_to = cutAt WHERE id, user_id
                       … 0 rows matched → roll back, answer VERSION_CHANGED
        plan.replace → DELETE schedule_template WHERE id, user_id   (slots cascade)
                       … 0 rows matched → roll back, answer VERSION_CHANGED
        always       → INSERT schedule_template (valid_from = cutAt, capped.validTo,
                                                 capped.boundaryKind)
        slots ≠ ∅    → INSERT template_slot × n
 8. revalidatePath("/schedule")
```

The trim happens **before** the insert so the two never overlap, not even for
the length of a statement — `schema.md` §4.7 states the same order.

The instant is read **once** and passed to `planTemplateEdit()` as its `now`.
The clock is otherwise consulted twice — here and inside the plan — and across a
Kyiv midnight those are two different dates, so the reads and the guards would
be about yesterday and the plan about today. `now` stays an instant, never a
date: the cut is still `today()`'s and cannot arrive from a form.

`plan.replace` is `DELETE` + `INSERT` rather than an `UPDATE` of the version's
slots. The outcome is the one §4.7 describes — one version, the same range,
different slots — and this shape keeps step 7 to a single way of writing slots.

### The day save writes two parity weeks

`saveTemplateDayAction` reads `bothWeeks = readTemplateBothWeeks(formData,
lessonNumbers)` — one boolean per rendered lesson number; the other parity is
`otherParity(parity)`, never submitted — and passes `saveDaySlots()` as its
`mutate` (ADR-025). Both weeks are therefore one slot set, one new version and
one transaction. The `mutate` keeps `changedInOther`; on success, if it is not
empty, the action returns `{ notice: BOTH_WEEKS_LABELS.saved(other,
changedInOther) }` («Також змінено у знаменнику: урок 2, урок 4»). Every
refusal — the schema's or `applyTemplateEdit()`'s — goes back with
`echoBothWeeks()` merged into `values`: `both-<n>` is `"on"` or `""` for every
rendered row, so a toggle submitted off is echoed off rather than missing.

### The three `mutate`s

| Action | `mutate` |
|---|---|
| day | `saveDaySlots(slots, { weekday, parity }, submitted, lessonNumbers, bothWeeks, sameLesson)` |
| copy | `copyParity(slots, from, to)` |
| boundary | `(slots) => [...slots]` |

---

## 3. Where `valid_to` comes from

`boundaryFor()`, in this order:

1. **the teacher named one** («доки діє» was submitted) → `resolveBoundary()`
   against the reference date below;
2. **a version is in force** → its `valid_to` and `boundary_kind` verbatim. Not
   re-resolved: overview §8.1 forbids resolving a symbol at any time but the
   write, so the stored pair moves across as it stands;
3. **neither** → `END_OF_SEMESTER`, the default of specification §5.1, resolved
   now.

`DATE` needs no rows. `NEXT_BREAK` and `END_OF_SEMESTER` resolve against
`getBoundaryFrame(userId, cutAt, { orUpcoming: true })`
(`lib/db/queries/boundaryFrame.ts`): the year's semesters and its `BREAK`
periods. The schedule page's `restatedTemplateBoundary()` reads the same frame
(T-047), so the action and the page cannot resolve the symbol differently.
A symbol that resolves to nothing → `boundaryRefusal()`.

**Which frame, and from which date.** `getBoundaryFrame()` takes the year
today falls inside (`getYearFrame()`) — the reference date is then `cutAt` and
this is the whole of the mid-year case. With `orUpcoming: true`, when today
falls in none, it takes the year about to begin (`getUpcomingYearFrame()`),
resolved **from its first day**. That is not a special case bolted on, it is
ADR-004's, and the expression is literally `ruleValidFrom(frame.yearStart,
cutAt)` — the later of the year's first day and today. Without it the first save of a template entered in August is refused with
`NO_YEAR`, which tells the teacher to set up the year she has just set up; the
day form renders no boundary control, so she has no way to answer it. Only when
neither read finds a year is `NO_YEAR` the truth, and the save is refused.

The version itself still starts at `cutAt`, in August, before the year: I1
allows nothing else, and a `schedule_template` row belongs to no year (below),
so a version that begins outside one is a schedule with nothing to show for its
first days, not an illegal row.

That refusal reaches a day save and a parity copy too — case 3 above is the
default `END_OF_SEMESTER`, and a year with no semesters resolves to nothing.
Those forms carry no boundary inputs. The action does not decide for them: it
always names the field (`rejectedField()`, as `weekdayRules.ts` does it), the
boundary form shows the message on that control, and a form that does not render
the field shows it through `FormMessage` — `formErrorsOf()`, overview §8.2
(T-023).

There is no "inside the year" check, unlike `non_teaching_weekday_rule`: a
`schedule_template` row is found by date overlap alone and belongs to no year,
so a version reaching past the year's last day is a schedule that keeps
applying, not a row listed under two years.

`capToNextVersion()` then caps the result at the next version's `valid_from`.
Without it «до кінця семестру» chosen while a later version exists produces an
overlap, and the teacher gets I3's refusal instead of a schedule.

**The cap moves the whole pair, not the date alone.** A capped `valid_to` came
from the next version's `valid_from`, so its `boundary_kind` is `DATE` —
whatever symbol produced the date it replaced. §8.1 stores the kind to say how
the date was arrived at and the screen renders it as such, so a capped date left
under `END_OF_SEMESTER` makes `VersionNotice` say «з 15.10 до 01.11 (до кінця
семестру)» about a semester ending on 25.12. It would also outlive the version:
case 2 above inherits the stored pair verbatim into every later version of the
view. `capToNextVersion()` therefore takes and returns the pair.

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

The layout is one day below `md` (selected by `?day=`) and the whole week from
`md` up; all seven are always rendered and six are hidden with CSS, which is
what keeps the day switcher a set of plain links. The week's columns depend on
the view — seven across for `OWN` at `xl`, wrapping over two or three for
`CLASS`, whose cell has four fields (overview §10.2).

**The row header is the place of a row's actions.** It is one line of fixed
height — «3 · 10:15», then the «в обох тижнях» toggle, then the clear icon —
so the seven cards stay on the same rows whether or not a row shows an icon.

**The toggle** (`both-weeks-toggle.tsx`, T-043, ADR-025) is a native checkbox
named `both-<lessonNumber>`, visually hidden inside a 24×24 `<label>` that
draws it: `Link2` on a filled `primary` chip when on, `Link2Off` on an
outlined muted chip when off. Its accessible name and hover hint are «Урок 3 —
в обох тижнях»; below `md` the words «в обох тижнях» are shown beside the icon.
It opens off whatever the two weeks hold, and after a refusal shows the echoed
`both-<n>`. `DayForm` passes `untrackedToggles()` — the toggles of rows where
`sameLesson()` holds between the two weeks' stored payloads — to
`TrackedForm`'s `untracked`, so switching one of those alone does not make
«Зберегти» available; on a row that differs the toggle is compared.

**The row's line.** Under the header, one `h-4` line of `text-xs`, present on
every row, so the cards stay aligned. `rowLine(view, parity, own, other)`
gives up to three candidate texts from the stored payloads of the two weeks,
each rendered as a `truncate` span with `data-both-line` and the whole text in
`title`; `app/globals.css` shows one, from `[data-both-toggle]:checked` and
whether every `[data-lesson-field]` of the row is `:placeholder-shown` —
`shownLine()` states the same rule for the tests:

| toggle | row | other week | line |
|---|---|---|---|
| off | — | equal to the row | empty |
| off | — | a different lesson | «Знаменник: Фізика · 7-А» |
| off | — | no lesson | «Знаменник: уроку немає» |
| on | not empty | no lesson | «додасть урок у знаменник» |
| on | not empty | a different lesson | «замінить «Фізика» у знаменнику» |
| on | not empty | equal | «зміни запишуться і в знаменник» |
| on | empty | a lesson | «видалить «Фізика» зі знаменника» |
| on | empty | no lesson | empty |

"Equal" and "different" are decided on the stored payloads when the page
renders; only the toggle and the row's emptiness are read live. A clear by the
icon leaves the toggle as it is.

**The clear icon** (`components/schedule/row-actions.tsx`, rules in
`rowClear.ts`, T-046):

- **Clear** — shown on a row with at least one non-empty lesson field (the
  inputs of `TEMPLATE_SLOT_FIELDS[view]` for that lesson number). It empties
  those inputs and nothing else, submits nothing (`type="button"`), and
  dispatches a bubbling `input` event on each field it changed, which is how
  `TrackedForm` sees it (T-047). The lesson is removed by the day's
  «Зберегти», as for a row emptied by hand (§1).
- **Undo** — in the same place, on a row emptied by the clear: it restores the
  values the row held just before the clear, unsaved edits included, with the
  same `input` events. Typing into the row again drops what the clear kept and
  shows the clear icon; so does any reset of the form, which React performs
  after every submission — a clear is undone only before the save.

Both are one `lucide-react` icon button of at least 24×24 px, named after the
lesson («Очистити урок 3», «Відновити урок 3») as its accessible name and its
hover hint. Nothing is rendered before hydration: with JavaScript off the form
has no icons and saves as before.

---

## 6. What the teacher is told about versions

`VersionNotice` is rendered from `listTemplateVersions()` and `today()`:

- **the version in force**, with its dates and the symbol it was entered under;
- **the I2 warning**, before the save and naming **three** dates — the last day
  the schedule in force will still cover (`today − 1`), the day it was going to
  run to, and the day the new one starts (`today`, the cut). It is said before,
  because after the trim the original `valid_to` is stored nowhere and cannot be
  named;
- **«почав діяти сьогодні»** instead of that warning when `valid_from = today`:
  nothing is being frozen, the edit lands in that version;
- **the versions that have ended**, listed — «історія не переписується» is a
  claim the screen can show rather than assert;
- **a later version**, if there is one, and the cap it puts on the new one;
- **the line about a past day**, pointing at the calendar (specification §5.3).

Backdating is not offered anywhere on the screen: no form takes a start date,
and `applyTemplateEdit()` takes no cut date to give one to.
