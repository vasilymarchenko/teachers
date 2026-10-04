# Save is available only with changes

**Ticket:** `docs/backlog/T-047-save-enabled-only-when-changed.md`
**Status:** authoritative for T-047.

Rationale lives in `docs/architecture/architect-overview.md` §8.2 (the
convention) and §8.1 (a stale symbolic boundary), and in
`decisions/ADR-026-save-is-available-only-with-changes.md`. This document adds
no reasoning: it states the modules, the states of the button, the per-form
opt-in and where each form's "opens as changed" comes from.

## 1. Modules

| File | Exports / change |
|---|---|
| `components/forms/form-changes.ts` | **new**, pure, no DOM: `FieldEntries`, `sameFields()`, `savedCleanly()`, `createChangeTracker()`, `formChanged()`, `submitAvailability()`, `reasonShown()` |
| `components/forms/tracked-form.tsx` | **new**, client: `TrackedForm`, `useFormChanges()` |
| `components/forms/submit-button.tsx` | reads `useFormChanges()`; `UNCHANGED_REASON` |
| `components/year/bell-grid.ts` | **new**: `bellGridChanged()` — the controlled bell grid's own report |
| `components/year/section.tsx` | gains `RestatedBoundary` — the sentence beside a stale boundary |
| `lib/domain/schedule/boundaries.ts` | gains `restatedBoundary()` |
| `components/events/event-form.tsx` | the repetition select becomes `defaultValue` + `onChange` (see `TrackedForm` below) |
| `components/ui/select.tsx` | an uncontrolled `Select` is keyed by its `defaultValue`: React applies a select's `defaultValue` only at mount and never updates `defaultSelected`, so without the remount the reset after an action would show the pre-save option and the record would hold it |
| `lib/db/queries/boundaryFrame.ts` | **new**: `getBoundaryFrame(userId, date, { orUpcoming })` → `{ yearStart, breaks, semesters }` or `null`. `boundaryFor()` in `lib/actions/scheduleTemplate.ts` (`orUpcoming: true`) and `resolveFor()` in `lib/actions/events.ts` read it instead of assembling the frame themselves |

### `createChangeTracker({ target, read, readDefaults, untracked, onChange })`

- `readDefaults()` — what the form would submit if reset to what the page
  rendered — is the **record**, taken on creation; the fields are compared at
  once, so a value typed before hydration reads as a change.
- `input` and `change` on `target` → `check()`; `reset` → `check()` one
  microtask later (the event fires before the defaults are restored).
- `check()` compares `read()` with the record by `sameFields()` — names and
  values in document order, `untracked` names dropped from both sides — and
  calls `onChange` only when the answer flips.
- `settle(state)`: `savedCleanly(state)` (no `error`, no `fieldErrors`, no
  `values` — what every action returns on success) → leave the refused state
  and retake the record; otherwise enter it and keep the record. Then
  `check()`.
- `refresh()`: retake the record unless refused, then `check()` — every
  render of the form (another form's save may have changed its defaults with
  this one mounted) and every `MutationObserver` callback.
- `setUntracked(names)`, `dispose()`.

### `TrackedForm`

| Prop | Meaning |
|---|---|
| `tracked` (default `true`) | `false` renders a plain `<form>` and provides no context |
| `state` | the form's `useActionState` result; a new one is passed to `settle()` from an effect, which runs after React's reset of the form |
| `changedOnOpen` | the page's server-side answer; ORed into the result (`formChanged()`) |
| `changed` | a controlled form's own answer; when given, no tracker is created |
| `untracked` | names left out of the comparison |

In the browser `read()` is `new FormData(form)` without `$ACTION*` entries and
`File`s; `readDefaults()` is the same over `form.cloneNode(true)` after
`reset()` on the copy. A `MutationObserver` (`childList`, `subtree`) calls
`refresh()` for a field the page adds or removes, and an effect with no
dependencies calls it after every render. A DOM-compared form therefore keeps
its controls' defaults in the DOM: `InfoEventForm`'s repetition select is
uncontrolled (`defaultValue`) with its choice mirrored into state, because a
controlled `<select>` mounted on the client marks no option as default. `hydrated` is `useSyncExternalStore` with a
`false` server snapshot.

## 2. The button

`submitAvailability({ tracked, hydrated, changed, pending })`:

| tracked | hydrated | pending | changed | result | rendered |
|---|---|---|---|---|---|
| no | — | no | — | `available` | as before T-047 |
| no | — | yes | — | `pending` | as before T-047: `disabled`, pending label |
| yes | no | no | — | `available` | no `aria-disabled` |
| yes | yes | yes | — | `pending` | `aria-disabled="true"`, pending label |
| yes | yes | no | no | `unchanged` | `aria-disabled="true"` |
| yes | yes | no | yes | `available` | no `aria-disabled` |

Inside a tracked form a muted button is `opacity-50 cursor-not-allowed`, stays
focusable, and its `onClick` calls `preventDefault()` — which also cancels
Enter in a field, since implicit submission fires a click at the default
button. A press while `unchanged` sets `reasonShown`; the `role="status"` span
beside the button then holds `UNCHANGED_REASON` («Немає змін, які треба
зберегти») and `aria-describedby` points at it. It is cleared when `changed`
becomes `true`. `DeleteButton` is a separate submitter with its own
`formAction` and is never muted.

## 3. Which forms opt in

| Form | Opt-in | Opens as changed when |
|---|---|---|
| `YearForm`, `SemesterForm`, `PeriodForm` | `tracked={row !== undefined}` | — |
| `RuleForm` | `tracked={rule !== undefined}` | `restatedUntil` — `restatedRules()` in `app/(app)/(schedule)/year/page.tsx`: `referenceDate = rule.validFrom`, the selected year's `BREAK` periods and semesters |
| `BellsForm` | `changed={bellGridChanged(…)}` | the stored rows do not share one length (the save would rewrite the ends) |
| `DayForm`, `OverrideForm` | always | — |
| `BoundaryForm` | always | `restatedUntil` — `restatedTemplateBoundary()` in `app/(app)/(schedule)/schedule/page.tsx`: `getBoundaryFrame(…, { orUpcoming: true })`, `referenceDate = ruleValidFrom(yearStart, today)`, then `capToNextVersion()` as the action does |
| `DeadlineForm` | `tracked={event !== undefined}` | — |
| `InfoEventForm` | `tracked={event !== undefined}` | `restatedUntil` — `restatedBoundaries()` in `app/(app)/(events)/events/page.tsx`: `getBoundaryFrame(userId, event.dateFrom)`, `referenceDate = event.dateFrom` |

Not opted in: `SignInForm`, every form that adds a row, the parity reset form,
`CopyParityForm`, `ClearLessonForm`, `RemoveOverrideForm`.

`restatedUntil` is exclusive, like `boundaryDate`; the sentence names the day
before it (`RULES_SECTION.restated`, `BOUNDARY_SECTION.restated`,
`EVENT_FORM.restated`). `restatedBoundary()` returns `undefined` for `DATE`, for
a symbol that still resolves to the stored date, and for one that resolves to
nothing.

## 4. Tests

| File | Covers |
|---|---|
| `components/forms/form-changes.test.ts` | an edit, an edit reverted, a cleared field, a checkbox, fields added and removed by the page, new defaults rendered by another form's save (with and without typing), a value typed before hydration, a value set from code with its `input` event, a reset, an untracked field, the record kept after a refusal (across a later render) and retaken after a success, `formChanged()` (stale and current boundary, controlled report), `submitAvailability()`, `reasonShown()` |
| `components/forms/submit-button.test.ts` | server render: available, no reason text, before hydration; unchanged outside a tracked form |
| `components/year/bell-grid.test.ts` | the controlled grid's report |
| `lib/domain/schedule/boundaries.test.ts` | `restatedBoundary()`: moved break, moved semester, current, `DATE`, unresolvable |
| `components/year/labels.test.ts` | the sentence names the new last day |

The DOM half — `new FormData(form)`, the `MutationObserver`, React's reset
timing — is not run by the suite, which has no DOM (`vitest.config.mts`).
