# Schedule domain — module contract

**Ticket:** `docs/backlog/T-005-domain-schedule-functions.md`
**Status:** authoritative for T-005.

Rationale lives in `docs/architecture/architect-overview.md` §3, §5 and §8. This
document adds no reasoning: it states the mechanics of `lib/domain/schedule` —
signatures, the input contract, the resolution rules and the decisions the
overview and `expand-fixtures.md` left open. Expected values are not restated
here; `expand-fixtures.md` holds them and the Vitest suite transcribes them.

---

## 1. Modules

| File | Exports |
|---|---|
| `types.ts` | `ResolvedLesson`, `ResolvedDay`, `LessonOrigin`, `DateRange`, `ScheduleInput` and its parts |
| `dates.ts` | `isoDayNumber`, `isoWeeksBetween`, `nextIsoDate`, `eachIsoDateInRange` — internal |
| `parity.ts` | `parityOn(date, anchors): Parity` |
| `calendarRules.ts` | `isNonTeachingOn(date, rules): boolean`, `weekdayOf(date): Weekday` |
| `boundaries.ts` | `resolveBoundary(request): IsoDate \| undefined` |
| `expand.ts` | `expand(input, request): ResolvedDay[]` |
| `copyOnWrite.ts` | `planTemplateEdit(request): TemplateEditPlan` |

Nothing in the directory imports Drizzle, `next` or a database client. The
`import type` lines that reach into `lib/db/schema/enums` and
`lib/validation/slotPayload` are erased at compile time and exist so that the
enum unions and the payload types have one definition each.

## 2. `ScheduleInput` — what a caller must supply

```ts
type ScheduleInput = {
  anchors:            readonly { date; parity }[];
  nonTeachingPeriods: readonly { dateFrom; dateTo }[];        // both inclusive
  weekdayRules:       readonly { weekday; validFrom; boundaryDate }[];
  bells:              readonly { lessonNumber; timeFrom; timeTo }[];
  templates:          readonly { view; validFrom; validTo; slots }[];
  overrides:          readonly { date; view; lessonNumber; kind; payload? }[];
};
```

Three obligations on T-008, which builds this from the database:

1. **Both views, always.** `templates` and `overrides` carry `OWN` and `CLASS`
   whichever view is asked for. `isTaughtByMe` is decided against the resolved
   `OWN` day (fixtures §8.6), so a `CLASS` window that omits the `OWN` rows
   silently answers `false` everywhere.
2. **Payloads arrive parsed.** `slotPayloadFor(view)` runs on the way out of the
   query, not in the domain (`schema.md` §7). `jsonb` is `unknown` and a cast is
   not a check.
3. **Rows must cover more than the window.** A version whose `validFrom` precedes
   the window still covers its dates, and an anchor before the window is the one
   in force inside it.

`expand()`'s range — `{ from, to }` — has **both ends inclusive**: it is an
entity range, not a validity boundary (`schema.md` §6). `[2026-10-12,
2026-11-13]` is the 33 days fixtures §6 lists.

## 3. Decisions this ticket settled

Each was open in the documents above; each is implemented in exactly one place.

**D-1. A `DATE` boundary is the teacher's inclusive last day, plus one.**
Overview §8.1 fixes `boundaryDate` as exclusive and gives the conversion for
`NEXT_BREAK` and `END_OF_SEMESTER` only. `resolveBoundary` takes `lastDay` — the
date the teacher picked in the form, the last day the rule still applies — and
returns the day after it. Fixtures §3.3 is the case that pins it: R2/R3 run to
the end of a year whose inclusive last day is `2027-05-31`, and store
`2027-06-01`. Every date a teacher sees is inclusive; only the stored bound is
not.

**D-2. `resolveBoundary` returns `undefined` rather than throwing.** No break
after the reference date, no semester covering it, a missing `lastDay`, or a
result that is not after the reference date all give `undefined`. That is the
signal for the form to ask for an explicit date, and it keeps the caller from
writing a row the `valid_from < boundary_date` check would reject.

**D-3. `END_OF_SEMESTER` and `NEXT_BREAK` resolve against the entity's
`validFrom`, not against `today()`.** Fixtures §3.8 writes the year frame on
2026-08-20 for rules that begin on 2026-09-01, and still resolves to S1's end.
`resolveBoundary` takes that date as `referenceDate`, and `END_OF_SEMESTER`
accepts the first semester that has not ended yet when the reference date
precedes them all.

**D-4. Parity extends backwards from the earliest anchor.** Overview §3.5 defines
the anchor in force as the last one with `date <= d` and says nothing about a
date before them all — which a teacher reaches by paging back to August.
`parityOn` uses the earliest anchor there and lets the alternation run backwards,
so `ResolvedDay.parity` is never undefined. An empty anchor list throws: the
year's initial parity *is* an anchor (overview §3.5), so an empty list is a
broken year setup and not a date the teacher can navigate to.

**D-5. A lesson number with no `BellSchedule` row keeps no time keys.**
`ResolvedLesson.timeFrom` and `timeTo` are optional. A teacher can delete a bell
row while an override on that number survives; the lesson still renders, without
times. This follows the fixtures' rule that an absent value is an absent key —
never `null`, never an empty string (§8.8).

**D-6. Dates stay `IsoDate` strings and are compared with `<=`.** A `YYYY-MM-DD`
string sorts in date order, so coverage, boundary and range tests need no date
library at all. `dates.ts` is reached only for week counting, weekday and
increment, and only through `date-fns` calendar functions — which compare
calendar fields, so a DST change cannot shift a result and no `new Date()` is
written anywhere (overview §8.5).

## 4. `expand()` — resolution order

For each date of the range, in this order:

1. `parityOn(date, anchors)` — computed for every date, non-teaching ones
   included (glossary §2).
2. `isNonTeachingOn(date, rules)` — one OR over `NonTeachingPeriod` (inclusive at
   both ends) and `NonTeachingWeekdayRule` (`validFrom <= d < boundaryDate`).
   View-independent.
3. Slots: the version whose `[validFrom, validTo)` covers **this date**, filtered
   to `(weekdayOf(date), parity)`. A non-teaching date contributes none; a gap
   contributes none and is not an error, and neither neighbouring version is
   consulted.
4. Overrides for `(date, view)`, applied **always** — `isNonTeaching` suppresses
   `origin = TEMPLATE` and nothing else, so a non-teaching date is never a short
   circuit (overview §3.4). `EDIT` replaces the payload or adds a lesson;
   `CLEARED` removes the slot and is a no-op where there is none; `SUBSTITUTION`
   renders its payload plus `replacedOriginal` **only** when a slot is in force
   underneath.
5. Sort by `lessonNumber`, attach bell times (D-5).

`replacedOriginal` is recomputed from the version and the parity in force on the
date being rendered, never frozen at the moment the substitution was written
(fixtures §8.4).

For `view = CLASS`, the `OWN` window is expanded as well and each lesson gets
`isTaughtByMe`: `true` when the resolved `OWN` day for the same date holds a
lesson with the same `lessonNumber` **and** the same `subject` (fixtures §8.6).
The cost is one extra expansion per `CLASS` window; comparing against the `OWN`
template instead is the wrong answer that fixtures §8.6 catches on 2026-10-19.
The residual weakness of comparing free-text subjects is Q-006.

## 5. `planTemplateEdit()` — the copy-on-write cases

```ts
planTemplateEdit({ current?, validTo, now? }) →
  { cutAt, trim?: { id, validTo }, replace?: { id }, create: { validFrom, validTo } }
```

`cutAt` is `today(now)` and is read here, never taken from the caller: an edit
whose cut date came from a form is the retroactive edit invariant I1 forbids. The
optional `now` is an **instant**, the same parameter `today()` itself takes, so a
test can pin the clock without being able to pin the date.

| `current` | Plan | Why |
|---|---|---|
| absent (a gap, or the first version) | `create` only | nothing to freeze (I2 trims nothing) |
| `validFrom < cutAt` | `trim` to `cutAt` + `create` | I1 and I2 together — fixtures §3.8, 2026-10-21 |
| `validFrom === cutAt` | `replace` + `create` | no past to freeze; a trim would leave `[d, d)`, which `schedule_template_range_ck` rejects |
| `validFrom > cutAt` | throws | not the version in force |
| `validTo <= cutAt` | throws | an empty interval |

**Out of scope by design:** versions that begin *after* the cut date. This plans
the edit against the one version in force; the editor (T-010) decides what to do
with a future version the new interval would overlap, and invariant I3 — the
`EXCLUDE USING gist` constraint — is the backstop that stops a wrong answer
reaching the database.

## 6. The test fixtures

`fixtures/scenario.ts` transcribes `expand-fixtures.md` §3 into a `ScheduleInput`;
`fixtures/expected.ts` transcribes §6 and §7 into `ResolvedDay[]`. Neither was
obtained by running the code, and a value in either that does not appear in the
fixture document is a bug in the transcription.

`scripts/seed.ts` transcribes the same §3 into database rows. The two
transcriptions are deliberately independent (fixtures §10): a divergence between
them is a transcription error worth finding.

Assertions use `toStrictEqual`, because §8.8 turns on `replacedOriginal` being
*absent* rather than `undefined`, and `toEqual` cannot tell the two apart.
