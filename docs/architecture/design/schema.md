# Database schema — full DDL

**Ticket:** `docs/backlog/T-003-db-schema-design.md`
**Status:** authoritative for `T-004`. The Drizzle schema in `lib/db/schema/*.ts`
and the first migration are transcriptions of this document, not independent
readings of the overview.

Rationale lives in `docs/architecture/architect-overview.md` §3, §4 and §8, and
the hand-computed behaviour this schema has to be able to store lives in
`docs/architecture/design/expand-fixtures.md`. This document adds no reasoning:
it states columns, types, constraints, indexes, migration order and the seed.
Where a choice is not derivable from the overview, it is marked and sent back as
a finding in §12 rather than argued here.

Language is English throughout, except Ukrainian demo payloads in §10 — the
teacher reads those (root `CLAUDE.md`).

---

## 1. Conventions

| Concern | Rule |
|---|---|
| Table names | `snake_case`, singular: `schedule_template`, not `schedule_templates` |
| Column names | `snake_case` in SQL; the Drizzle property is the `camelCase` identifier from `glossary.md` (`valid_from` ↔ `validFrom`) |
| Primary key | `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` — core in PostgreSQL 16, no extension needed |
| Tenancy | `user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE` on every profile table (§8) |
| Timestamps | `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` on every table the teacher edits |
| Domain dates | `date`, no time zone (overview §8.5) |
| Clock times | `time` (without time zone) — `BellSchedule` only (overview §8.5) |
| Free text | `text`, never `varchar(n)`: subjects, class names, teacher names are free text (overview §4) and a length cap buys nothing |
| Payloads | `jsonb`, validated by Zod at the Server Action boundary (§7) |
| Enums | PostgreSQL enum types (`CREATE TYPE ... AS ENUM`), one per closed value set (§2) |
| Date intervals | half-open `[from, to)` with an exclusive upper bound everywhere **except** `non_teaching_period`, whose `date_from`/`date_to` are both inclusive (overview §8.1, fixtures §3.2) |

`id`, `user_id`, `created_at` and `updated_at` are housekeeping columns, not
domain terms; they are covered by `glossary.md` §7 and are not repeated in the
per-table coverage check in §9.

**Why `user_id` is `text` and not `uuid`.** The referenced `user` table is
better-auth's, and better-auth's default id generator produces a string, not a
UUID. Matching its type is not optional — a `uuid` column cannot carry a foreign
key to a `text` primary key. See §5.1.

---

## 2. Enum types

Eight enum types. Every value below already exists in `glossary.md`; adding a
value is a migration (`ALTER TYPE ... ADD VALUE`), which is why each set is
closed on purpose.

```sql
CREATE TYPE parity            AS ENUM ('NUMERATOR', 'DENOMINATOR');
CREATE TYPE schedule_view     AS ENUM ('OWN', 'CLASS');
CREATE TYPE weekday           AS ENUM ('MON','TUE','WED','THU','FRI','SAT','SUN');
CREATE TYPE non_teaching_kind AS ENUM ('BREAK', 'PUBLIC_HOLIDAY', 'OTHER');
CREATE TYPE day_override_kind AS ENUM ('EDIT', 'SUBSTITUTION', 'CLEARED');
CREATE TYPE boundary_kind     AS ENUM ('DATE', 'NEXT_BREAK', 'END_OF_SEMESTER');
CREATE TYPE event_kind        AS ENUM ('DEADLINE', 'INFO');
CREATE TYPE recurrence_kind   AS ENUM ('NONE', 'WEEKLY', 'MONTHLY', 'YEARLY');
```

**`weekday` is stored as a name, not a number.** `MON` … `SUN` correspond to ISO
weekday numbers 1 … 7 (`date-fns` `getISODay`), and the week starts on Monday
everywhere (overview §3.5, §8.5). Storing the name rather than a `smallint`
removes the whole class of off-by-one between ISO (Mon = 1) and JavaScript
`getDay()` (Sun = 0); the mapping exists in exactly one place in
`lib/domain/schedule/calendarRules.ts`.

**`view` on the slot comes from the parent.** `template_slot` has no `view`
column — it inherits the one on `schedule_template` (§4.7). `day_override` has
its own, because it has no parent (overview §4, fixtures §3.7: O5 clears a
`CLASS` lesson while the `OWN` view keeps its own lesson 2).

---

## 3. Table overview

| Table | Owner column | Parent | What it is |
|---|---|---|---|
| `user` | — | — | better-auth's; not written here (§5.1) |
| `academic_year` | `user_id` | — | `AcademicYear` |
| `semester` | `user_id` | `academic_year` | `Semester` |
| `non_teaching_period` | `user_id` | `academic_year` | `NonTeachingPeriod` |
| `non_teaching_weekday_rule` | `user_id` | — | `NonTeachingWeekdayRule` |
| `bell_schedule` | `user_id` | — | `BellSchedule` |
| `parity_anchor` | `user_id` | — | `ParityAnchor` |
| `schedule_template` | `user_id` | — | `ScheduleTemplate` (a **version**) |
| `template_slot` | `user_id` | `schedule_template` | `TemplateSlot` |
| `day_override` | `user_id` | — | `DayOverride` |
| `event` | `user_id` | — | `Event` |

Eleven tables, ten of them ours. `ResolvedLesson`, `ResolvedDay`, `parity` and
`replacedOriginal` have **no** table: they are computed (glossary §2, §3).

---

## 4. Tables

### 4.1 `academic_year`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `user_id` | `text` | no | | → `user(id)` `ON DELETE CASCADE` |
| `name` | `text` | no | | e.g. «2026–2027» |
| `date_from` | `date` | no | | inclusive |
| `date_to` | `date` | no | | **inclusive** — the last day of the year |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

```sql
CONSTRAINT academic_year_dates_ck CHECK (date_from <= date_to),
CONSTRAINT academic_year_id_user_uq UNIQUE (id, user_id),   -- composite FK target, §8
EXCLUDE USING gist (
  user_id WITH =,
  daterange(date_from, date_to, '[]') WITH &&
)
```

`INDEX academic_year_user_from_idx ON academic_year (user_id, date_from)`.

**No `initial_parity` column.** Overview §4 lists «початкова парність» on
`AcademicYear`, and §3.5 says the initial value **is** a `ParityAnchor`
(«окремої сутності "скидання" немає»). Storing it twice makes the two able to
disagree, and `parity()` reads only anchors. The year-setup form's «рік
починається з чисельника» writes a `ParityAnchor` at `date_from` and nothing
else. Overview §4 and `glossary.md` §1 have been corrected in the same commit as
this document — see finding F-1.

**Why years may not overlap.** `boundaries.ts` resolves `END_OF_SEMESTER` and
`NEXT_BREAK` by asking which year and semester a date falls in (overview §8.1);
two overlapping years make that question have two answers.

### 4.2 `semester`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `user_id` | `text` | no | | → `user(id)` `ON DELETE CASCADE` |
| `academic_year_id` | `uuid` | no | | composite FK, §8 |
| `index` | `smallint` | no | | 1 or 2 (glossary §1) |
| `date_from` | `date` | no | | inclusive |
| `date_to` | `date` | no | | inclusive |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

```sql
CONSTRAINT semester_year_fk FOREIGN KEY (academic_year_id, user_id)
  REFERENCES academic_year (id, user_id) ON DELETE CASCADE,
CONSTRAINT semester_index_ck CHECK (index IN (1, 2)),
CONSTRAINT semester_dates_ck CHECK (date_from <= date_to),
CONSTRAINT semester_year_index_uq UNIQUE (user_id, academic_year_id, index),
EXCLUDE USING gist (
  user_id WITH =,
  daterange(date_from, date_to, '[]') WITH &&
)
```

`INDEX semester_user_year_idx ON semester (user_id, academic_year_id, index)` —
covered by the unique constraint's index, which already starts with `user_id`.

`index` is a reserved word in some dialects but not in PostgreSQL; Drizzle quotes
identifiers anyway. The name comes from `glossary.md` §1 and is kept.

A semester is a **continuous** range; breaks inside it are `non_teaching_period`
rows and are not subtracted here (overview §4).

### 4.3 `non_teaching_period`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `user_id` | `text` | no | | → `user(id)` `ON DELETE CASCADE` |
| `academic_year_id` | `uuid` | no | | composite FK, §8 |
| `kind` | `non_teaching_kind` | no | | `BREAK` \| `PUBLIC_HOLIDAY` \| `OTHER` |
| `name` | `text` | no | | Ukrainian, the teacher reads it |
| `date_from` | `date` | no | | **inclusive** |
| `date_to` | `date` | no | | **inclusive** — a one-day holiday has `date_from = date_to` |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

```sql
CONSTRAINT non_teaching_period_year_fk FOREIGN KEY (academic_year_id, user_id)
  REFERENCES academic_year (id, user_id) ON DELETE CASCADE,
CONSTRAINT non_teaching_period_dates_ck CHECK (date_from <= date_to)
```

`INDEX non_teaching_period_user_range_idx ON non_teaching_period (user_id, date_from, date_to)`.

**This is the one inclusive-`date_to` in the model** (overview §8.1: «у моделі
немає жодного інклюзивного кінця діапазону, крім `NonTeachingPeriod.dateTo`»).
Fixtures §3.2 depends on it: P1 is `2026-10-14 … 2026-10-14`.

**Periods are deliberately allowed to overlap** — a `PUBLIC_HOLIDAY` inside a
`BREAK` is a normal data shape, and `isNonTeaching` is an OR over rows, so an
overlap changes no answer. No exclusion constraint here.

**Where `NEXT_BREAK` resolves to.** `boundaries.ts` takes the earliest
`date_from` among rows with `kind = 'BREAK'` and `date_from > today()`; that day
is the exclusive `boundary_date` (overview §8.1, fixtures §3.3 R1 → 2026-10-26).
`PUBLIC_HOLIDAY` and `OTHER` do not resolve a `NEXT_BREAK` — «найближчі
канікули» means a break.

### 4.4 `non_teaching_weekday_rule`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `user_id` | `text` | no | | → `user(id)` `ON DELETE CASCADE` |
| `weekday` | `weekday` | no | | `MON` … `SUN` |
| `valid_from` | `date` | no | | **inclusive**, resolved at write time |
| `boundary_date` | `date` | no | | **exclusive** |
| `boundary_kind` | `boundary_kind` | no | | display only (overview §8.1) |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

```sql
CONSTRAINT ntwr_range_ck CHECK (valid_from < boundary_date)
```

`INDEX ntwr_user_weekday_idx ON non_teaching_weekday_rule (user_id, weekday, valid_from)`.

**The rule applies to a date `d` when `valid_from <= d < boundary_date`.**
`valid_from` exists because of fixtures §9 F-3: without it a rule entered in
October reaches back over every past Friday and silently rewrites history,
contradicting specification §5.2. It is resolved at write time exactly as
`ScheduleTemplate.valid_from` is — the write sets it to `today()`
(`lib/time/today.ts`), never to a caller-supplied date. Year setup (T-009) is the
one exception: it writes `valid_from = academic_year.date_from` for the rules it
creates as part of the year frame, which is what makes the fixture's R1–R3 legal
from 2026-09-01.

**Overlapping rules for the same weekday are allowed.** Two rules covering the
same Friday are redundant, not contradictory: the predicate is an OR. Adding an
exclusion constraint would reject the legitimate «methodical day, paused, resumed
later» sequence only if the ranges touched, and buys nothing otherwise.

**There is no implicit weekend.** Saturday and Sunday are non-teaching only
because rows say so (fixtures §9, F-3, "Related"). Year setup creates R2/R3.

### 4.5 `bell_schedule`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `user_id` | `text` | no | | → `user(id)` `ON DELETE CASCADE` |
| `lesson_number` | `smallint` | no | | 0 … 9 |
| `time_from` | `time` | no | | no date, no time zone (overview §8.5) |
| `time_to` | `time` | no | | |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

```sql
CONSTRAINT bell_schedule_number_ck CHECK (lesson_number BETWEEN 0 AND 9),
CONSTRAINT bell_schedule_times_ck  CHECK (time_from < time_to),
CONSTRAINT bell_schedule_user_number_uq UNIQUE (user_id, lesson_number)
```

The unique constraint's index starts with `user_id` and is the only index needed.

Only the numbers actually in use have rows (specification §3.3); fixtures §3.4
defines 1 … 5 and leaves 0 and 6 … 9 absent. `bell_schedule` is scoped to the
user, not to the year — that is overview §4 read literally; see finding F-2.

### 4.6 `parity_anchor`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `user_id` | `text` | no | | → `user(id)` `ON DELETE CASCADE` |
| `date` | `date` | no | | inclusive: the anchor is in force from this date |
| `parity` | `parity` | no | | `NUMERATOR` \| `DENOMINATOR` |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

```sql
CONSTRAINT parity_anchor_user_date_uq UNIQUE (user_id, date)
```

`INDEX` — the unique constraint's index `(user_id, date)` serves the only query
there is: the last anchor with `date <= d`.

The year's initial value is a row here, not a column on `academic_year` (§4.1).
An anchor need not fall on a Monday; fixtures §5 F-1 pins what happens when it
does not.

### 4.7 `schedule_template`

The version table. One row = one version of the weekly template for one `view`.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `user_id` | `text` | no | | → `user(id)` `ON DELETE CASCADE` |
| `view` | `schedule_view` | no | | `OWN` \| `CLASS` |
| `valid_from` | `date` | no | | **inclusive** |
| `valid_to` | `date` | no | | **exclusive** |
| `boundary_kind` | `boundary_kind` | no | | how `valid_to` was entered; display only |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

```sql
CONSTRAINT schedule_template_range_ck CHECK (valid_from < valid_to),
CONSTRAINT schedule_template_id_user_uq UNIQUE (id, user_id),  -- composite FK target, §8
EXCLUDE USING gist (
  user_id WITH =,
  view    WITH =,
  daterange(valid_from, valid_to) WITH &&
)
```

This is invariant **I3** from overview §3.2, and it is the reason `btree_gist` is
a dependency: the `=` operator on `text` (`user_id`) and on an enum (`view`) has
no GiST operator class in core PostgreSQL. The extension supplies both.

Three details that make the constraint actually hold:

- `daterange(a, b)` — the two-argument form — is `IMMUTABLE` and defaults to
  `'[)'`, which is exactly the half-open interval the model uses. The
  three-argument form with a literal bound string is equally immutable; the
  two-argument form is used because the default is the intended one.
- `valid_from < valid_to` is not decoration. `daterange(d, d)` is the **empty**
  range, and an empty range overlaps nothing — without the check, any number of
  zero-length versions would slip past the exclusion.
- `valid_to` is `NOT NULL`. Every repeating thing in the product is entered with
  an end (specification §3.4, the callout); an unbounded version would need
  `daterange(valid_from, NULL)` and would then collide with every future version
  instead of being trimmed by I2.

**No separate index.** The exclusion constraint creates a GiST index on
`(user_id, view, daterange(valid_from, valid_to))`, which starts with `user_id`
and answers the only lookup there is:

```sql
SELECT * FROM schedule_template
WHERE user_id = $1 AND view = $2
  AND daterange(valid_from, valid_to) @> $3::date;
```

That satisfies the `user_id`-first index rule of overview §8.4 without a second
index to maintain.

**Copy-on-write is application logic, not a constraint** (overview §3.2 I1/I2).
The database rejects an overlap; it does not perform the trim. `lib/actions`
does the two writes — `UPDATE ... SET valid_to = today()` on the current version,
`INSERT` the new one — in one transaction, in that order, so the exclusion is
never transiently violated. The cut point is always `today()` from
`lib/time/today.ts` (T-005).

**Gaps are legal.** Nothing forbids `[A, B)` followed by `[C, D)` with `B < C`;
fixtures §3.6 requires the `CLASS` gap `[2026-10-21, 2026-11-02)` to survive.

### 4.8 `template_slot`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `user_id` | `text` | no | | → `user(id)`; also half of the composite FK below |
| `template_id` | `uuid` | no | | → `schedule_template` |
| `weekday` | `weekday` | no | | |
| `lesson_number` | `smallint` | no | | 0 … 9 |
| `parity` | `parity` | no | | the slot belongs to one parity week |
| `payload` | `jsonb` | no | | shape depends on the parent's `view` (§7) |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

```sql
CONSTRAINT template_slot_template_fk FOREIGN KEY (template_id, user_id)
  REFERENCES schedule_template (id, user_id) ON DELETE CASCADE,
CONSTRAINT template_slot_number_ck CHECK (lesson_number BETWEEN 0 AND 9),
CONSTRAINT template_slot_cell_uq
  UNIQUE (template_id, weekday, lesson_number, parity)
```

`INDEX template_slot_user_template_idx ON template_slot (user_id, template_id, weekday, parity)`
— the shape `expand()` reads: all slots of one version for one weekday and one
parity.

A slot is present only when the cell is filled. `«—»` in the fixture tables
(fixtures §3.6, e.g. `MON/2` denominator in OWN-V1) means **no row**, not a row
with an empty payload. That is what makes «no slot in force» reachable without a
version gap, which O7 depends on (fixtures §8.8).

«Скопіювати з чисельника» is a UI action that inserts the mirrored rows
(glossary §3); it has no column and no table.

### 4.9 `day_override`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `user_id` | `text` | no | | → `user(id)` `ON DELETE CASCADE` |
| `date` | `date` | no | | the override is bound to a date, not to a version |
| `view` | `schedule_view` | no | | its own — there is no parent |
| `lesson_number` | `smallint` | no | | 0 … 9 |
| `kind` | `day_override_kind` | no | | `EDIT` \| `SUBSTITUTION` \| `CLEARED` |
| `payload` | `jsonb` | **yes** | | `NULL` exactly when `kind = 'CLEARED'` |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

```sql
CONSTRAINT day_override_number_ck CHECK (lesson_number BETWEEN 0 AND 9),
CONSTRAINT day_override_payload_ck
  CHECK ((kind = 'CLEARED') = (payload IS NULL)),
CONSTRAINT day_override_slot_uq UNIQUE (user_id, date, view, lesson_number)
```

`INDEX day_override_user_date_idx ON day_override (user_id, date, view)` — the
range read `expand()` does over a window; the unique constraint's index also
starts with `user_id` and serves the single-slot lookup.

The `payload` check is the whole of «`CLEARED` is a tombstone»: the row exists,
the content is empty, and that is what distinguishes «урок скасовано» from «no
override, the template applies» (overview §3.4). `NULL` and not `'{}'::jsonb`,
so the constraint is a single expression and no code has to decide whether an
empty object means «cleared» or «forgot to fill it in».

**No `replaced_original` column.** It is recomputed from the version and the
parity in force on the date being rendered, never frozen at write time
(fixtures §8.4 — this is the single most load-bearing "do not store this" in the
model). Glossary §3: «обчислюється з шаблону, не зберігається».

**No `template_id`, no foreign key to a version.** The override survives a
template change (overview §3.4) and is legal with nothing underneath it at all
(fixtures §8.8, O4/O7/O8).

**No `academic_year_id`.** An override is addressed by date; making it a child of
a year would mean a cascade delete on a year edit, which the model does not want.

### 4.10 `event`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `user_id` | `text` | no | | → `user(id)` `ON DELETE CASCADE` |
| `kind` | `event_kind` | no | | `DEADLINE` \| `INFO` |
| `title` | `text` | no | | Ukrainian, the teacher reads it |
| `note` | `text` | yes | | free text |
| `date_from` | `date` | no | | `DEADLINE`: the due date. `INFO`: first day |
| `date_to` | `date` | yes | | `INFO` only, **inclusive**; `NULL` = one day |
| `done` | `boolean` | yes | | `DEADLINE` only (glossary §5) |
| `recurrence_kind` | `recurrence_kind` | no | `'NONE'` | `INFO` only |
| `boundary_date` | `date` | yes | | **exclusive**; required iff recurring |
| `boundary_kind` | `boundary_kind` | yes | | display only; required iff recurring |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

```sql
CONSTRAINT event_range_ck CHECK (date_to IS NULL OR date_from <= date_to),
CONSTRAINT event_done_ck  CHECK ((kind = 'DEADLINE') = (done IS NOT NULL)),
CONSTRAINT event_deadline_shape_ck CHECK (
  kind <> 'DEADLINE'
  OR (date_to IS NULL AND recurrence_kind = 'NONE')
),
CONSTRAINT event_recurrence_ck CHECK (
  (recurrence_kind = 'NONE')
  = (boundary_date IS NULL AND boundary_kind IS NULL)
),
CONSTRAINT event_boundary_ck CHECK (
  boundary_date IS NULL OR date_from < boundary_date
)
```

`INDEX event_user_date_idx ON event (user_id, date_from)`, plus
`INDEX event_user_recurring_idx ON event (user_id, recurrence_kind, date_from)
 WHERE recurrence_kind <> 'NONE'` — a recurring event has to be read for a
window its `date_from` is not inside, so it cannot be found by the date index.

`event_deadline_shape_ck` is overview §4 as a constraint: a `DEADLINE` is
one-off, because `done` is one field per event and a repeating deadline would
close a whole series at once. The database, not a comment, is what keeps that
true.

`recurrence_kind` values `WEEKLY` / `MONTHLY` / `YEARLY` are new in this
document and have been added to `glossary.md` §5 in the same commit; `YEARLY` is
the one specification §6.3 names («13 вересня — День золотої рибки», «Хелловін»).
Expanding a recurrence into dates is T-012's `recurrence.ts`, not a stored row.

`birthday` (glossary §6) has no table here: `Student` is second-phase work
(overview §7) and no ticket exists for it.

---

## 5. The `user` table and better-auth

### 5.1 Where it comes from

`user`, `session`, `account` and `verification` are better-auth's tables. They
are **not** designed here: they are generated from the better-auth config by

```sh
npx @better-auth/cli generate --output lib/db/schema/auth.ts
```

Two consequences T-004 has to act on:

1. `lib/db/schema/auth.ts` must exist and be part of the **first** migration.
   Every profile table has a foreign key to `user(id)`, so `user` has to be
   created no later than they are. T-006 keeps `requireUser()` and the sign-in
   flow; the tables cannot wait for it. An acceptance criterion has been added to
   T-004 for this.
2. `user_id` is `text` (§1). Do not "tidy" it to `uuid`.

### 5.2 What we add to it

Nothing. No profile columns, no settings column. Per-teacher settings that exist
today are the year frame (§4.1–§4.6) and nothing else.

---

## 6. Boundary pairs

Overview §8.1 makes «до дати Х / до найближчих канікул / до кінця семестру» a
single mechanic: the symbol is resolved to a date **at write time**, and both
halves are stored.

| Table | Date column | Kind column | Exclusive? |
|---|---|---|---|
| `non_teaching_weekday_rule` | `boundary_date` | `boundary_kind` | yes |
| `schedule_template` | `valid_to` | `boundary_kind` | yes |
| `event` (recurring `INFO`) | `boundary_date` | `boundary_kind` | yes |

`schedule_template` is the one that does not spell the column `boundary_date`:
its exclusive upper bound is `valid_to`, because that is the name the exclusion
constraint and the `[validFrom, validTo)` notation use throughout overview §3.2
and the fixtures. The `boundary_kind` beside it records how the teacher entered
that date («до кінця семестру») so the UI can say it back.

**Exclusive means exclusive, everywhere.** A rule applies to `d` while
`d < boundary_date`. `NEXT_BREAK` resolves to the **first day** of the break;
`END_OF_SEMESTER` to the **day after** `semester.date_to` (overview §8.1). The
one inclusive end in the whole model is `non_teaching_period.date_to` (§4.3).

`boundary_kind` is never read by `expand()`. It exists so the UI can render «до
зимових канікул» instead of a bare date. Changing the dates of a break does
**not** move an already-resolved `boundary_date` — that is the accepted price in
overview §9.

---

## 7. Payloads and the Zod boundary

`template_slot.payload` and `day_override.payload` are `jsonb`. The database
enforces *that a payload is present* (and, for `day_override`, that it is absent
exactly for `CLEARED`); it enforces **nothing about its shape**. That is overview
§3.3 and the trade-off row in overview §9 — «payload слота типізується за `view`
у Zod, а не в БД» — and it is what keeps one version table serving two views
without a nullable column for every field of both.

**The boundary is `lib/validation/slotPayload.ts`, and it is the only place
`view`-specific validation happens.** Two schemas plus a discriminator:

```ts
// lib/validation/slotPayload.ts  (T-004 creates it, T-010/T-011 use it)
export const ownSlotPayload = z.object({
  subject:   z.string().min(1),
  className: z.string().min(1),
});

export const classSlotPayload = z.object({
  subject:     z.string().min(1),
  teacherName: z.string().min(1),
  zoomLink:    z.url().optional(),
  note:        z.string().optional(),
});

export const slotPayloadFor = (view: ScheduleView) =>
  view === "OWN" ? ownSlotPayload : classSlotPayload;
```

Rules that go with it:

- Every Server Action that writes a `template_slot` or a `day_override` parses
  the payload with `slotPayloadFor(view)` **before** the insert. There is no
  second parser anywhere.
- Every read that hands a payload to the domain parses it on the way out too.
  `jsonb` is `unknown` at the type level; a cast is not a check. This is cheap —
  the cost is a `safeParse` per slot on a window that already costs a few
  thousand slot computations (overview §9).
- The `OWN` payload has exactly two keys and the `CLASS` payload exactly four
  (specification §5.1). `zoomLink` and `note` are optional; `subject`,
  `className` and `teacherName` are not. The fixture writes `—` for an absent
  optional field, meaning **the key is absent**, not an empty string.
- A `day_override` payload has the same shape as a slot payload of the same
  `view`. An `EDIT` or a `SUBSTITUTION` renders as a lesson, so it carries a
  lesson's fields.
- Payload keys are `camelCase` inside the JSON — they are TypeScript object keys,
  not SQL identifiers, and they match the glossary identifiers verbatim.

**Why not a check constraint with `jsonb_typeof`.** It would duplicate the Zod
schema in SQL, in a form that cannot be kept in step with it and that reports
errors a form cannot show. The accepted cost of the single-table decision is that
the shape lives in one place; putting half of it in the database gives up the
benefit and keeps the cost.

---

## 8. `user_id` discipline in the schema

Overview §8.4 needs three things to be true of every profile table. They are:

| Table | `user_id NOT NULL` | Index starting with `user_id` |
|---|---|---|
| `academic_year` | ✓ | `academic_year_user_from_idx`, and the exclusion's GiST index |
| `semester` | ✓ | `semester_year_index_uq`, and the exclusion's GiST index |
| `non_teaching_period` | ✓ | `non_teaching_period_user_range_idx` |
| `non_teaching_weekday_rule` | ✓ | `ntwr_user_weekday_idx` |
| `bell_schedule` | ✓ | `bell_schedule_user_number_uq` |
| `parity_anchor` | ✓ | `parity_anchor_user_date_uq` |
| `schedule_template` | ✓ | the exclusion constraint's GiST index |
| `template_slot` | ✓ | `template_slot_user_template_idx` |
| `day_override` | ✓ | `day_override_user_date_idx` |
| `event` | ✓ | `event_user_date_idx` |

The third thing — `userId` as the first argument of every query, taken only from
`requireUser()` — is T-006, and cannot be expressed in DDL.

**Child tables carry `user_id` too, and cannot disagree with the parent.**
`semester`, `non_teaching_period` and `template_slot` each have a `user_id`
column *and* a composite foreign key to `(id, user_id)` of their parent:

```sql
-- on the parent
CONSTRAINT academic_year_id_user_uq UNIQUE (id, user_id),
-- on the child
FOREIGN KEY (academic_year_id, user_id)
  REFERENCES academic_year (id, user_id) ON DELETE CASCADE
```

The denormalised column is what lets every query filter on `user_id` without a
join — which is the only way the §8.4 rule stays cheap enough to actually follow.
The composite key is what stops it from being a lie: a slot cannot be attached to
another user's template, because no such `(id, user_id)` pair exists. Without the
composite key, `user_id` on a child table is a value the application sets and can
therefore set wrongly.

---

## 9. Migration order

`drizzle-kit` cannot express `CREATE EXTENSION` or an `EXCLUDE` constraint, so
the migration set is generated plus two hand-written files
(`npx drizzle-kit generate --custom --name=...`). Order matters: the extension
has to exist before the constraint that needs its operator classes.

| # | File | How | Contents |
|---|---|---|---|
| 0000 | `0000_btree_gist.sql` | custom | `CREATE EXTENSION IF NOT EXISTS btree_gist;` |
| 0001 | `0001_<generated>.sql` | `drizzle-kit generate` | the eight enum types; better-auth's `user`/`session`/`account`/`verification`; the ten tables of §4 with primary keys, foreign keys, unique constraints, check constraints and plain indexes |
| 0002 | `0002_exclusion_constraints.sql` | custom | the three `EXCLUDE USING gist` constraints — `academic_year`, `semester`, `schedule_template` |

Inside 0001 the generated order is FK order, which drizzle-kit already produces:
enums → `user` (and the rest of better-auth) → `academic_year` → `semester`,
`non_teaching_period` → `non_teaching_weekday_rule`, `bell_schedule`,
`parity_anchor`, `day_override`, `event` → `schedule_template` → `template_slot`.

Two things about the custom files:

- Their statements are invisible to the drizzle-kit snapshot in `drizzle/meta`.
  That is fine as long as nothing later tries to drop or recreate the affected
  tables — a `DROP TABLE` in a future generated migration would take the
  exclusion constraint with it, and it would have to be re-added by hand.
  Recorded here so a future migration does not lose I3 silently.
- `CREATE EXTENSION` needs a superuser or a role with `CREATE` on the database.
  In Compose the `postgres` role is the owner, so it works; on a managed host
  `btree_gist` has to be on the provider's allow-list. It is on every mainstream
  one, but the deploy step (T-015) fails loudly rather than silently if it is
  not — `IF NOT EXISTS` does not paper over a permission error.

### 9.1 What must exist before the first seed run

All of 0000–0002. The seed is run after `drizzle-kit migrate` has applied the
whole set, never against a partially migrated database, because three of its
properties are asserted by constraints rather than by the seed itself:

| Constraint | What the seed proves by not violating it |
|---|---|
| `btree_gist` + `schedule_template` exclusion | OWN-V1 and OWN-V2 abut without overlapping (fixtures §3.6); CLASS-V1 and CLASS-V2 leave a gap and are still accepted |
| `schedule_template_range_ck` | no zero-length version slipped in |
| `day_override_payload_ck` | O2, O5 and O8 are `CLEARED` with `payload IS NULL`; O1, O3, O4, O6, O7 carry one |
| `template_slot_cell_uq` | no cell was written twice while transcribing §3.6 |
| composite FKs (§8) | every slot belongs to a template of the same user |

The exclusion constraint is the one that must be in place *specifically* before
the seed: T-004's constraint test inserts an overlapping pair and expects the
database to reject it, and a seed that ran without the constraint would leave a
database the test then cannot trust.

---

## 10. The `seed` script

**File:** `scripts/seed.ts`. **Command:** `npm run db:seed` →
`tsx scripts/seed.ts` (`tsx` added as a dev dependency in T-004; Node 22's
`--experimental-strip-types` is the alternative if the dependency is unwanted).

**Content: `docs/architecture/design/expand-fixtures.md` §3, in full and
verbatim.** The fixture document is the single source for the scenario — the
seed transcribes it and the T-005 test expectations transcribe it, and neither
restates it independently (T-004). A value that appears in the seed and not in
the fixture is a bug in the seed.

What that means concretely:

| Fixture section | Rows |
|---|---|
| §3.1 | one `academic_year` (2026-09-01 … 2027-05-31), two `semester` |
| §3.2 | two `non_teaching_period`: P1 the one-day holiday, P2 the full break week |
| §3.3 | three `non_teaching_weekday_rule`: R1 `FRI`/`NEXT_BREAK`, R2 `SAT`, R3 `SUN` |
| §3.4 | five `bell_schedule` rows, lesson numbers 1 … 5 |
| §3.5 | two `parity_anchor`: A1 the year's initial value, A2 the reset |
| §3.6 | four `schedule_template` (two per view) and their `template_slot` rows |
| §3.7 | eight `day_override`: O1 … O8 |

Plus one `user` row — the demo teacher, created through better-auth's own API
rather than by inserting into its tables, so the password hash is what
better-auth expects. Credentials come from the environment
(`SEED_USER_EMAIL`, `SEED_USER_PASSWORD`), with a development default; they are
never committed.

**`valid_from` on R1–R3** is `2026-09-01`, the year's `date_from` — they are
created as part of the year frame (§4.4). Not `today()`: the seed is writing a
past scenario, and a rule dated today would make every Friday before it teaching.

**Insert order.** The straightforward path is to insert the intervals of §3.6
already at their final values — OWN-V1 with `valid_to = 2026-10-21` directly.
That is what the seed does. Fixtures §3.8 gives the write timeline that produced
those values, and a seed that replayed it would additionally exercise
copy-on-write (I2); it is not what this seed is for, and T-004 says so.

**Idempotency.** `npm run db:seed` deletes the demo user's rows and re-inserts
them, in one transaction. `ON DELETE CASCADE` from `user` does most of it;
`day_override`, `parity_anchor`, `bell_schedule`, `non_teaching_weekday_rule`,
`schedule_template` and `event` are cascaded from `user` directly, and
`template_slot`, `semester` and `non_teaching_period` from their parents. Running
it twice leaves the same database.

**Guard.** The script refuses to run when `NODE_ENV === "production"` unless
`SEED_ALLOW_PRODUCTION=1` is set. It deletes data; the guard is the difference
between a demo reset and an accident on the VPS (T-015).

**Language.** Every payload value the teacher would read is Ukrainian — subject
names, class names, teacher names, notes, the period names («Осінні канікули»,
«День захисників і захисниць України»). The script, its identifiers and its
comments are English (root `CLAUDE.md`).

**Size.** The fixture is 33 days × 2 views of expected output from about 70
stored rows (44 of them `template_slot`). That is enough to open every calendar view against real data and to
hit every branch of `expand()` — a version gap, an absent slot, a full break
week, a mid-week version switch, a mid-week parity reset, and all three override
kinds both with and without a slot underneath.

---

## 11. Coverage check: every name has a glossary entry

T-003's last acceptance criterion. Each table and each domain column, against
`docs/architecture/glossary.md`.

| Name in the schema | Glossary entry |
|---|---|
| `academic_year`, `date_from`, `date_to` | §1 `AcademicYear` |
| `academic_year.name` | §1 — the year's own label, same `name` as `NonTeachingPeriod` |
| `semester`, `index` | §1 `Semester` |
| `non_teaching_period`, `kind`, `name` | §1 `NonTeachingPeriod` and its three `kind` values |
| `non_teaching_weekday_rule`, `weekday` | §1 `NonTeachingWeekdayRule` |
| `non_teaching_weekday_rule.valid_from` | §4 — **added in this commit** (F-3 of the fixtures) |
| `bell_schedule`, `time_from`, `time_to` | §1 `BellSchedule` |
| `lesson_number` | §1 `lessonNumber` |
| `parity_anchor`, `date`, `parity` | §2 `ParityAnchor`, `NUMERATOR`, `DENOMINATOR` |
| `schedule_template`, `valid_from`, `valid_to` | §3 `ScheduleTemplate` |
| `template_slot`, `payload` | §3 `TemplateSlot` |
| `view`, `OWN`, `CLASS` | §3 `view` |
| `subject`, `className`, `teacherName`, `zoomLink`, `note` (payload keys, `camelCase` — §7) | §3, the `OWN` and `CLASS` payload rows |
| `day_override`, `kind` = `EDIT` \| `SUBSTITUTION` \| `CLEARED` | §3 `DayOverride` |
| `boundary_date`, `boundary_kind`, `DATE`, `NEXT_BREAK`, `END_OF_SEMESTER` | §4 |
| `event`, `kind` = `DEADLINE` \| `INFO`, `done` | §5 `Event` |
| `event.title`, `event.note` | §5 — **added in this commit** |
| `recurrence_kind`, `NONE` \| `WEEKLY` \| `MONTHLY` \| `YEARLY` | §5 `recurrence` — the four values **added in this commit** |
| `id`, `user_id`, `created_at`, `updated_at` | §7 — code-only terms, no product counterpart |

Names that are deliberately **absent** from the schema, each because the glossary
says it is computed: `parity` as a stored week property, `replacedOriginal`,
`isTaughtByMe`, `ResolvedLesson`, `ResolvedDay`, `origin`.

---

## 12. Findings sent onward

The same channel `expand-fixtures.md` §9 used: things this exercise settled or
could not settle, recorded where the next ticket will read them.

**F-1 — `AcademicYear` no longer stores the initial parity.**
Overview §4 and glossary §1 listed «початкова парність» as a field of
`AcademicYear`, while overview §3.5 said the initial value *is* a `ParityAnchor`
and that no separate «reset» entity exists. Both cannot be true without the two
being able to disagree, and `parity()` reads only anchors — so the column would
be write-only data that silently contradicts the calendar. Resolved by dropping
it: year setup writes a `ParityAnchor` at `date_from`. Overview §4 and glossary
§1 corrected in this commit. No behaviour in the fixtures changes — fixtures §3.1
already lists both Y1's initial parity and A1, and A1 is now the only carrier.

**F-2 — `BellSchedule` is scoped to the user, not to the year.**
Overview §4 gives it no `yearId`, and this document follows that literally. The
consequence worth knowing: editing a bell time changes the rendered times of
lessons in the past too, because `ResolvedLesson` takes its times from the
current row (overview §5). That is a rewrite of displayed history, which
specification §5.2 forbids for the schedule — the schedule itself is safe,
only the clock times move. Left as is: a second academic year is the trigger, and
the fix is a `academic_year_id` column plus a copy at year rollover, on a table
with at most ten rows per year. Recorded so T-009 does not have to rediscover it.

**F-3 — a `lesson_number` with no `bell_schedule` row has no times.**
Nothing constrains `template_slot.lesson_number` or
`day_override.lesson_number` to a number the teacher has given bells to; a
foreign key would force bells to be entered before any schedule, which year setup
(T-009) does not require in that order. `ResolvedLesson` in overview §5 declares
`timeFrom`/`timeTo` unconditionally, so T-005 has to decide between omitting them
and rejecting the write. The cheap answer, and the one the fixtures support
(§3.4: only the numbers in use have rows, and every used number has one), is a
Zod-level check in the slot form — «спершу задайте час для цього уроку» — rather
than a database constraint. Flagged for T-005 and T-010, not decided here.

**F-4 — a `DayOverride` cannot move a lesson's time.**
Specification §5.3 says a single day can be edited to «додати урок, прибрати,
змінити предмет чи час». Changing the *number* changes the time, because times
come from `bell_schedule` by `lesson_number`, and that is the reading this schema
implements. A genuinely per-day time — «сьогодні третій урок о 10:40» — would be
two nullable columns on `day_override`, and neither the overview nor the fixtures
ask for one. Not added: an unused nullable column is a wrong answer that looks
like a right one. If the teacher does ask for it, it is one migration on a table
whose readers already treat times as derived.
