# Calendar read queries

**Ticket:** `docs/backlog/T-008-calendar-read-queries.md`
**Status:** authoritative for T-008.

Rationale lives in `docs/architecture/architect-overview.md` §2, §5 and §8.4.
This document adds no reasoning: it states the mechanics — the signatures T-007
and T-012 call, the predicate each range read uses, and the indexes those
predicates are answered from.

---

## 1. Modules

Every function takes `userId` first (overview §8.4), is read-only, and returns
plain data: no Drizzle row type reaches `lib/domain` or a component.

| File | Exports |
|---|---|
| `lib/db/queries/scheduleInput.ts` | `getScheduleInput(userId, range)` — the assembling read; returns `ScheduleInput` |
| `lib/db/queries/parityAnchors.ts` | `getParityAnchors(userId, range)` |
| `lib/db/queries/calendarRules.ts` | `getNonTeachingPeriods(userId, range)`, `getNonTeachingPeriodsForDisplay(userId, range)`, `getNonTeachingWeekdayRules(userId, range)` |
| `lib/db/queries/bells.ts` | `getBellSchedule(userId)` |
| `lib/db/queries/templates.ts` | `getTemplateVersions(userId, range)` |
| `lib/db/queries/overrides.ts` | `getDayOverrides(userId, range)` |
| `lib/db/queries/events.ts` | `getEventsInRange(userId, range)`, `EventRow` |
| `lib/db/queries/yearFrame.ts` | `getYearFrame(userId, date)`, `YearFrame` |
| `lib/validation/slotPayload.ts` | `parseSlotPayload(view, payload, where)` — the read half of the Zod boundary (schema §7) |
| `lib/db/fixtures/scenarioRows.ts` | `insertFixtureScenario(userId, db)` — fixtures §3 as rows, shared by the seed and the integration suite |
| `lib/db/client.ts` | `closeDb()` — added for scripts and tests; the application never calls it |
| `lib/db/testDatabase.ts` | `createRecordingDatabase()` — test support for the index-usage check |

`range` is the domain's `DateRange` (`{ from, to }`, **both ends inclusive**).

## 2. Predicates

A window is `[from, to]`, inclusive at both ends. An entity range is inclusive;
a validity boundary is exclusive (schema §6), and that is the whole difference
between the two shapes below.

| Read | Predicate |
|---|---|
| `non_teaching_period` | `date_from <= to AND date_to >= from` |
| `non_teaching_weekday_rule` | `valid_from <= to AND boundary_date > from` |
| `schedule_template` | `valid_from <= to AND valid_to > from` |
| `day_override` | `date BETWEEN from AND to` |
| `event`, one-off | `recurrence_kind = 'NONE' AND date_from <= to AND coalesce(date_to, date_from) >= from` |
| `event`, recurring | `recurrence_kind <> 'NONE' AND date_from <= to AND boundary_date > from` |
| `parity_anchor` | `date <= to` — **not** an overlap; see §3 |
| `bell_schedule` | `user_id` only: at most ten rows, scoped to the user and not to a date (schema §4.5) |

## 3. The two reads that are not overlaps

**`parity_anchor`.** `parityOn()` computes parity from the last anchor with
`date <= d` (overview §3.5), so an anchor selected by overlap with the window
would drop the year's initial anchor and shift every week in view. The read is
every anchor up to `to` — an index range scan, and a handful of rows a year. A
window entirely before the first anchor returns nothing, so a second query
supplies the earliest anchor alone: `parityOn()` extends it backwards rather
than failing, and the calendar renders for a teacher paging into August.

**Both views, always.** `getTemplateVersions()` and `getDayOverrides()` ignore
the view being rendered and return `OWN` and `CLASS` alike, because
`isTaughtByMe` on a `CLASS` lesson is resolved against the **resolved** `OWN`
day for the same date, overrides included (fixtures §8.6). A read narrowed to
`CLASS` would answer `false` throughout and look plausible; the integration test
against the golden `CLASS` days is what catches it.

## 4. Query count

`getScheduleInput()` issues six reads concurrently (`Promise.all`), of which
`getTemplateVersions()` is itself two — eight statements, none of which grows
with the length of the range. The slots are fetched in a single second query
through the same predicate as the versions, rather than one query per version:
that is the N+1 the shape exists to avoid, and re-using the predicate instead of
an `inArray` of ids keeps the two from drifting into a version whose slots are
missing.

No caching, per overview §9 ("Без кешування на старті"), whose trigger is the
~300 ms year-view render. The reaction recorded there is to wrap this one
result, which is why assembly is one function rather than six calls spread
through a page.

## 5. Payloads

`template_slot.payload` and `day_override.payload` are `jsonb` — `unknown` at
the type level, and a cast is not a check (schema §7). Every payload leaving a
query goes through `parseSlotPayload(view, payload, where)`, which throws naming
the row. A `CLEARED` override has no payload and the key is **absent** from the
result, never `null` (fixtures §8.8).

Bell times are `time` in Postgres and come back as `HH:MM:SS`; the domain and the
fixture spell them `HH:MM` (fixtures §3.4), so whole seconds are trimmed. A time
with non-zero seconds is passed through rather than rounded — it is a data-entry
mistake worth seeing.

## 6. Index usage

`lib/db/queries/indexUsage.integration.test.ts` captures the SQL each module
actually sends (Drizzle's logger, through `createRecordingDatabase()`), runs
`EXPLAIN (FORMAT JSON)` on it with `enable_seqscan = off`, and asserts two
things: no `Seq Scan`, and every index chosen has `user_id` as its leading
column. Sequential scans are disabled because on the ~200 fixture rows the
planner would rightly read the table; the question being asked is whether a
usable index exists, not what the planner does at this size.

The indexes the reads land on, all defined in `docs/architecture/design/schema.md`:

| Read | Index chosen |
|---|---|
| `parity_anchor` | `parity_anchor_user_date_uq` |
| `non_teaching_period` | `non_teaching_period_user_range_idx` (index-only) |
| `non_teaching_weekday_rule` | `ntwr_user_weekday_idx` |
| `bell_schedule` | `bell_schedule_user_number_uq` |
| `schedule_template` | `schedule_template_no_overlap_ex` — the gist exclusion index of §4.7, which leads with `user_id` and therefore serves the range read as well |
| `template_slot` | `template_slot_user_template_idx`, joined to `schedule_template_id_user_uq` |
| `day_override` | `day_override_slot_uq` |
| `event` | `event_user_date_idx`; the partial `event_user_recurring_idx` covers the recurring branch when it is the selective one |
| `academic_year` | `academic_year_no_overlap_ex`, the same shape as `schedule_template` above |
| `semester` | `semester_year_index_uq` |

Every one of them has `user_id` as its first column, which is the property the
test asserts — the index names themselves are what the planner happened to pick
at this size and are recorded here as observation, not as a contract.

## 7. Fixture rows

`lib/db/fixtures/scenarioRows.ts` holds the transcription of
`expand-fixtures.md` §3 into database rows, moved out of `scripts/seed.ts` so
that the seed and the integration suite insert the same rows. It stays
**independent of** `lib/domain/schedule/fixtures/scenario.ts`, which transcribes
the same section for the unit suite (fixtures §10): the integration test asserts
that reading the first back produces the second, and that assertion is only
worth making while the two are written separately.

## 8. What this ticket does not do

- No mutations. Writes are T-009 (year setup), T-010 (templates), T-011
  (overrides), T-012 (events).
- No recurrence expansion. `getEventsInRange()` returns the recurring rows whose
  validity covers the window; turning one into dates is T-012's
  `recurrence.ts`, and a returned row may produce no occurrence in the window.
- No caching, and no `unstable_cache` — see §4.
