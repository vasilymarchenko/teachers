# Golden fixtures for `expand()` — the hard-week walkthrough

**Ticket:** `docs/backlog/T-001-expand-fixtures.md`
**Status:** authoritative. `T-005` (Vitest suite) and `T-004` (seed script) are
derived from this document, not the other way round.

Rationale lives in `docs/architecture/architect-overview.md` §3 and §5 and in
`docs/specs/specification.md` §4–§5. This document adds no reasoning: it is a
hand-computed input/output pair, plus the short list of decisions the exercise
forced (§8).

Every expected value below was derived by hand from the rules in overview §3.
No code was run to obtain any of them; the only machine assistance used was
`date(1)` for weekday and ISO-week numbers.

---

## 1. What the walkthrough covers

The window is **2026-10-12 … 2026-11-13** — five ISO weeks, chosen because all
three hard mechanics collide inside it:

| ISO week | Dates | What happens |
|---|---|---|
| 2026-W42 | 10-12 … 10-18 | Baseline week. A one-day `PUBLIC_HOLIDAY`; an `EDIT` override; an override on a **non-teaching Saturday**. |
| 2026-W43 | 10-19 … 10-25 | Mid-week `ScheduleTemplate` version switch (Wed 10-21). A `CLEARED` override. The `CLASS` gap opens. |
| 2026-W44 | 10-26 … 11-01 | A **full break week** — seven non-teaching days. |
| 2026-W45 | 11-02 … 11-08 | First teaching week after the break (the Q-001 default is observable on Mon–Tue), a **mid-week `ParityAnchor` reset** on Wed 11-04, the `FRI` rule expires, the `SUBSTITUTION` falls due. |
| 2026-W46 | 11-09 … 11-13 | The reset's effect on the following week; a `CLASS`-only `CLEARED`; the two overrides with **no `TemplateSlot` underneath**. |

Both views (`OWN`, `CLASS`) are expanded over the whole window.

---

## 2. Notation

- Dates are ISO (`YYYY-MM-DD`). Weeks are ISO weeks, Monday-first (overview §3.5).
- Intervals are written `[validFrom, validTo)` — **`validFrom` inclusive,
  `validTo` exclusive**, everywhere in this document.
- A lesson is written `«N · HH:MM–HH:MM · payload · ORIGIN»`, where `N` is
  `lessonNumber`, the times come from `BellSchedule`, and `ORIGIN` is
  `ResolvedLesson.origin`.
- `OWN` payload is written `subject · className`; `CLASS` payload is written
  `subject · teacherName · zoomLink · note` (`—` for an empty optional field).
- `⊘` means an empty `lessons: []`.
- Payload values are Ukrainian: they are demo data a teacher reads (root
  `CLAUDE.md` language rule). Everything around them is English.

`ResolvedDay` and `ResolvedLesson` are as defined in overview §5. In the `OWN`
view `isTaughtByMe` is absent; in the `CLASS` view it is always present.

---

## 3. Fixture input

All rows belong to one `User` (`userId = U1`); the column is omitted below.

### 3.1 `AcademicYear` and `Semester`

| Entity | Fields |
|---|---|
| `AcademicYear` Y1 | `dateFrom = 2026-09-01`, `dateTo = 2027-05-31`, initial parity `NUMERATOR` |
| `Semester` S1 | `index = 1`, `dateFrom = 2026-09-01`, `dateTo = 2026-12-24` |
| `Semester` S2 | `index = 2`, `dateFrom = 2027-01-12`, `dateTo = 2027-05-31` |

### 3.2 `NonTeachingPeriod`

| Id | `kind` | `name` | `dateFrom` | `dateTo` |
|---|---|---|---|---|
| P1 | `PUBLIC_HOLIDAY` | «День захисників і захисниць України» | 2026-10-14 | 2026-10-14 |
| P2 | `BREAK` | «Осінні канікули» | 2026-10-26 | 2026-11-01 |

`dateFrom` and `dateTo` are both **inclusive** — a one-day holiday has
`dateFrom = dateTo` (overview §4).

P2 spans exactly 2026-W44, Monday through Sunday. That is what makes it a *full*
break week rather than a break that merely touches a week.

### 3.3 `NonTeachingWeekdayRule`

| Id | `weekday` | `boundaryKind` | `boundaryDate` | Meaning |
|---|---|---|---|---|
| R1 | `FRI` | `NEXT_BREAK` | 2026-10-26 | «методичний день», in force until the autumn break starts |
| R2 | `SAT` | `DATE` | 2027-06-01 | weekend |
| R3 | `SUN` | `DATE` | 2027-06-01 | weekend |

`boundaryDate` is **exclusive**: a rule applies to a date `d` when
`d < boundaryDate` (overview §8.1). R1 therefore covers Fri 2026-10-16 and
Fri 2026-10-23 but **not** Fri 2026-11-06 — the rule ends where the break begins.

R2/R3 are the reason Saturdays and Sundays come out non-teaching; see finding
F-3 in §9.

### 3.4 `BellSchedule`

| `lessonNumber` | `timeFrom` | `timeTo` |
|---|---|---|
| 1 | 08:30 | 09:15 |
| 2 | 09:25 | 10:10 |
| 3 | 10:25 | 11:10 |
| 4 | 11:20 | 12:05 |
| 5 | 12:15 | 13:00 |

Numbers 0 and 6–9 are unused, as §3.3 of the specification allows.

### 3.5 `ParityAnchor`

| Id | `date` | `parity` | Note |
|---|---|---|---|
| A1 | 2026-09-01 | `NUMERATOR` | the year's initial value (overview §3.5: the initial value *is* an anchor) |
| A2 | 2026-11-04 | `NUMERATOR` | reset entered after the autumn break, deliberately **mid-week** |

A2 is mid-week on purpose: it is the cheapest way to pin what the §3.5 formula
does when an anchor does not fall on a Monday. See §5 and finding F-1 in §9.

### 3.6 `ScheduleTemplate` versions

| Id | `view` | `[validFrom, validTo)` |
|---|---|---|
| OWN-V1 | `OWN` | `[2026-09-01, 2026-10-21)` |
| OWN-V2 | `OWN` | `[2026-10-21, 2026-12-25)` |
| CLASS-V1 | `CLASS` | `[2026-09-01, 2026-10-21)` |
| CLASS-V2 | `CLASS` | `[2026-11-02, 2026-12-25)` |

The two `OWN` versions abut: no gap, no overlap. The two `CLASS` versions leave
a **gap `[2026-10-21, 2026-11-02)`** — allowed by overview §3.2 and expected to
render as an empty calendar, not an error. §3.8 says how each interval got its
value.

#### `TemplateSlot` — OWN-V1 (`subject · className`)

| `weekday` | `lessonNumber` | `NUMERATOR` | `DENOMINATOR` |
|---|---|---|---|
| MON | 1 | Математика · 7-А | Математика · 7-А |
| MON | 2 | Алгебра · 9-А | — |
| TUE | 2 | Геометрія · 9-А | Геометрія · 9-А |
| WED | 1 | Математика · 7-А | Математика · 7-А |
| WED | 3 | Інформатика · 7-А | Алгебра · 9-А |
| THU | 2 | Математика · 6-Б | Математика · 6-Б |
| FRI | 1 | Математика · 6-Б | Математика · 6-Б |

#### `TemplateSlot` — OWN-V2 (`subject · className`)

| `weekday` | `lessonNumber` | `NUMERATOR` | `DENOMINATOR` |
|---|---|---|---|
| MON | 1 | Математика · 7-А | Математика · 7-А |
| MON | 2 | Алгебра · 9-А | Алгебра · 9-А |
| TUE | 2 | Геометрія · 9-А | — |
| WED | 1 | Математика · 7-А | Математика · 7-А |
| WED | 3 | Інформатика · 7-А | Інформатика · 7-А |
| THU | 2 | Математика · 5-В | Алгебра · 9-А |
| FRI | 1 | Математика · 5-В | Геометрія · 9-А |

The differences that the window actually exercises: `WED/3` in the denominator
week (Алгебра → Інформатика, visible on Wed 10-21), `TUE/2` in the denominator
week (Геометрія → nothing, visible on Tue 11-03 and 11-10), and the whole
Thursday and Friday column (6-Б → 5-В / 9-А).

#### `TemplateSlot` — CLASS-V1 (`subject · teacherName · zoomLink · note`), class 7-А

| `weekday` | `lessonNumber` | `NUMERATOR` | `DENOMINATOR` |
|---|---|---|---|
| MON | 1 | Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — | Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — |
| MON | 2 | Українська мова · Шевченко О. П. · https://zoom.us/j/7a-ukr · — | Українська мова · Шевченко О. П. · https://zoom.us/j/7a-ukr · — |
| WED | 1 | Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — | Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — |
| WED | 3 | Інформатика · Ковальчук М. І. · https://zoom.us/j/7a-it · «кабінет 12» | Історія · Бондар І. С. · https://zoom.us/j/7a-hist · — |

#### `TemplateSlot` — CLASS-V2 (`subject · teacherName · zoomLink · note`), class 7-А

| `weekday` | `lessonNumber` | `NUMERATOR` | `DENOMINATOR` |
|---|---|---|---|
| MON | 1 | Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — | Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — |
| MON | 2 | Українська мова · Шевченко О. П. · https://zoom.us/j/7a-ukr · — | Українська мова · Шевченко О. П. · https://zoom.us/j/7a-ukr · — |
| WED | 1 | Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — | Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — |
| WED | 3 | Інформатика · Ковальчук М. І. · https://zoom.us/j/7a-it · — | Інформатика · Ковальчук М. І. · https://zoom.us/j/7a-it · — |
| FRI | 2 | Фізика · Ткаченко Л. В. · https://zoom.us/j/7a-phys · — | Фізика · Ткаченко Л. В. · https://zoom.us/j/7a-phys · — |

The teacher (`Ковальчук М. І.`) is the class teacher of 7-А, so `MON/1`,
`WED/1` and `WED/3` appear in both views. That duplication is intended
(specification §6.2) and is what `isTaughtByMe` marks.

### 3.7 `DayOverride`

| Id | `date` | `lessonNumber` | `view` | `kind` | `payload` |
|---|---|---|---|---|---|
| O1 | 2026-10-13 | 2 | `OWN` | `EDIT` | Алгебра (контрольна) · 9-А |
| O2 | 2026-10-19 | 1 | `OWN` | `CLEARED` | — (tombstone) |
| O3 | 2026-11-05 | 2 | `OWN` | `SUBSTITUTION` | Фізика · 8-А |
| O4 | 2026-10-22 | 1 | `CLASS` | `EDIT` | Виховна година · Шевченко О. П. · — · «замість уроків» |
| O5 | 2026-11-09 | 2 | `CLASS` | `CLEARED` | — (tombstone) |
| O6 | 2026-10-17 | 3 | `OWN` | `EDIT` | Відпрацювання · 7-А |
| O7 | 2026-11-10 | 2 | `OWN` | `SUBSTITUTION` | Хімія · 8-А |
| O8 | 2026-11-12 | 3 | `CLASS` | `CLEARED` | — (tombstone) |

O4 sits inside the `CLASS` version gap — there is no `TemplateSlot` under it.
O5 clears a `CLASS` lesson on a date where the `OWN` view keeps its own
`lessonNumber = 2`; overrides are keyed by `view` and do not leak across.

O6 sits on a **non-teaching** date — Sat 2026-10-17, made non-teaching by rule
R2 — and is the only row in the fixture where `isNonTeaching: true` coexists with
a non-empty `lessons` (§8.7).

O7 and O8 are the two «nothing underneath» cases (§8.8): a `SUBSTITUTION` on a
`lessonNumber` the template leaves empty, and a `CLEARED` on a `lessonNumber` the
template leaves empty. Neither is an error; they differ in what they render.

### 3.8 How the intervals got their values (write timeline)

`expand()` never sees this timeline — it is here so the intervals in §3.6 and
the shift in §8.4 are reproducible rather than asserted.

| Date of the write | Action | Effect on stored rows |
|---|---|---|
| 2026-08-20 | Year setup: Y1, S1, S2, P1, P2, R1–R3, bells, anchor A1 | as in §3.1–§3.5 |
| 2026-08-20 | Weekly template entered for both views. `OWN` boundary `END_OF_SEMESTER` → `validTo = 2026-12-25`; `CLASS` boundary `DATE` → `validTo = 2026-10-21` | OWN-V1 `[09-01, 12-25)`, CLASS-V1 `[09-01, 10-21)` |
| 2026-10-13 | Override entered on today's lesson | O1 |
| **2026-10-15** | Substitution entered **for a future date**, 2026-11-05 | O3 |
| 2026-10-17 | Make-up lesson entered on today — a Saturday that R2 makes non-teaching | O6 |
| 2026-10-19 | Lesson cancelled on today | O2 |
| **2026-10-21** | Teacher edits the weekly template. Copy-on-write cuts at `today() = 2026-10-21` (overview §3.2 I1, I2) | OWN-V1 trimmed to `[09-01, **10-21**)`; OWN-V2 `[10-21, 12-25)` created |
| 2026-10-22 | Override entered on today | O4 |
| 2026-11-02 | New class schedule entered from today | CLASS-V2 `[11-02, 12-25)`. CLASS-V1 already ended on 10-21, so I2 trims nothing and the gap survives |
| 2026-11-04 | Parity reset entered from today | anchor A2 |
| 2026-11-09 | Class lesson cancelled on today | O5 |
| 2026-11-10 | Substitution entered on today, on a `lessonNumber` the template leaves empty | O7 |
| 2026-11-12 | Class lesson cancelled on today, with nothing scheduled under it | O8 |

O3 is the interesting one: it was written on 2026-10-15, six days before OWN-V2
existed and twenty days before A2 existed. Both later writes move what
`replacedOriginal` resolves to — see §8.4.

---

## 4. Which `ScheduleTemplate` version covers which date

| Date range in the window | `OWN` | `CLASS` |
|---|---|---|
| 2026-10-12 … 2026-10-20 | OWN-V1 | CLASS-V1 |
| 2026-10-21 … 2026-11-01 | OWN-V2 | **none (gap)** |
| 2026-11-02 … 2026-11-13 | OWN-V2 | CLASS-V2 |

2026-10-21 belongs to OWN-V2 because `validFrom` is inclusive. The switch lands
on a Wednesday, so 2026-W43 is served by two different versions — Mon–Tue by V1,
Wed–Fri by V2.

---

## 5. Parity, computed by hand

Formula (overview §3.5), with `NUMERATOR = 0`, `DENOMINATOR = 1`:

```
parity(d) = anchor.parity XOR ( weeksBetween( startOfISOWeek(anchor.date),
                                              startOfISOWeek(d) ) % 2 )
where anchor = the last ParityAnchor with date ≤ d
```

`startOfISOWeek(A1.date) = startOfISOWeek(2026-09-01) = 2026-08-31` (2026-W36).
`startOfISOWeek(A2.date) = startOfISOWeek(2026-11-04) = 2026-11-02` (2026-W45).

| Dates | Anchor in force | `startOfISOWeek(d)` | Δ weeks | Δ % 2 | `parity` |
|---|---|---|---|---|---|
| 2026-10-12 … 10-18 (W42) | A1 | 2026-10-12 | 6 | 0 | `NUMERATOR` |
| 2026-10-19 … 10-25 (W43) | A1 | 2026-10-19 | 7 | 1 | `DENOMINATOR` |
| 2026-10-26 … 11-01 (W44) | A1 | 2026-10-26 | 8 | 0 | `NUMERATOR` |
| 2026-11-02 … 11-03 | A1 | 2026-11-02 | 9 | 1 | `DENOMINATOR` |
| 2026-11-04 … 11-08 | **A2** | 2026-11-02 | 0 | 0 | `NUMERATOR` |
| 2026-11-09 … 11-13 (W46) | A2 | 2026-11-09 | 1 | 1 | `DENOMINATOR` |

Three things this table pins:

1. **The break week consumes a parity position.** W44 is entirely non-teaching
   and still advances the counter (Δ 7 → 8 → 9). Under the current default
   (Q-001), the first teaching week after the break, W45, would be
   `DENOMINATOR` throughout — the alternation continues as if the break had been
   an ordinary week. Mon 2026-11-02 and Tue 2026-11-03 assert exactly that value
   and are the dates a change to Q-001 would flip.
2. **A non-Monday anchor splits its own week.** A2 sits on Wednesday, so W45 is
   `DENOMINATOR` on Mon–Tue and `NUMERATOR` on Wed–Fri. This follows from the
   formula as written; it is a consequence worth knowing, not a defect (F-1).
3. **The reset is observable in the next week.** Without A2, W46 would be
   `NUMERATOR` (Δ 10, even). With A2 it is `DENOMINATOR`. Any implementation
   that ignores anchors after the first will fail on 2026-11-09 … 11-13.

`parity` is computed for every date, including non-teaching ones: it is a
property of the date, not of the lessons (glossary §2).

---

## 6. Expected output — `OWN` view

`expand(range = [2026-10-12, 2026-11-13], view = OWN)` → 33 `ResolvedDay`
entries. `isTaughtByMe` is absent on every lesson below.

### 2026-W42 — `NUMERATOR`, OWN-V1

| Date | Day | `isNonTeaching` | `lessons` |
|---|---|---|---|
| 2026-10-12 | Mon | `false` | `1 · 08:30–09:15 · Математика · 7-А · TEMPLATE`<br>`2 · 09:25–10:10 · Алгебра · 9-А · TEMPLATE` |
| 2026-10-13 | Tue | `false` | `2 · 09:25–10:10 · Алгебра (контрольна) · 9-А · EDIT` |
| 2026-10-14 | Wed | `true` (P1) | ⊘ |
| 2026-10-15 | Thu | `false` | `2 · 09:25–10:10 · Математика · 6-Б · TEMPLATE` |
| 2026-10-16 | Fri | `true` (R1) | ⊘ |
| 2026-10-17 | Sat | `true` (R2) | `3 · 10:25–11:10 · Відпрацювання · 7-А · EDIT` |
| 2026-10-18 | Sun | `true` (R3) | ⊘ |

- 10-13: O1 replaces the payload of the `TUE/2` slot. `origin = EDIT`, no
  `replacedOriginal` — that field belongs to `SUBSTITUTION` only (overview §5).
- 10-14: the template would have given `1 · Математика · 7-А` and
  `3 · Інформатика · 7-А`. The non-teaching check suppresses both — it wins over
  the **template**, and only over the template.
- **10-17 is a non-teaching day that still has a lesson.** R2 makes the Saturday
  non-teaching, so the template contributes nothing; O6 is bound to the date and
  renders anyway. `isNonTeaching` stays `true` **and** `lessons` is non-empty.
  This is the pair that separates «the template does not expand here» from «the
  day is blank» — see §8.7.

### 2026-W43 — `DENOMINATOR`, OWN-V1 → OWN-V2 on Wed

| Date | Day | `isNonTeaching` | `lessons` |
|---|---|---|---|
| 2026-10-19 | Mon | `false` | ⊘ |
| 2026-10-20 | Tue | `false` | `2 · 09:25–10:10 · Геометрія · 9-А · TEMPLATE` |
| 2026-10-21 | Wed | `false` | `1 · 08:30–09:15 · Математика · 7-А · TEMPLATE`<br>`3 · 10:25–11:10 · Інформатика · 7-А · TEMPLATE` |
| 2026-10-22 | Thu | `false` | `2 · 09:25–10:10 · Алгебра · 9-А · TEMPLATE` |
| 2026-10-23 | Fri | `true` (R1) | ⊘ |
| 2026-10-24 | Sat | `true` (R2) | ⊘ |
| 2026-10-25 | Sun | `true` (R3) | ⊘ |

- **10-19 is the day that separates «cancelled» from «non-teaching».**
  OWN-V1 `MON/DENOMINATOR` holds one slot, `1 · Математика · 7-А`; O2 is a
  `CLEARED` tombstone on it. The result is a **teaching day with no lessons**:
  `isNonTeaching = false`, `lessons = []`. A day that renders identically to
  10-16 in a naive UI must not be modelled identically.
- **10-21 is the mid-week switch.** Under OWN-V1 the denominator Wednesday
  would have been `1 · Математика · 7-А` + `3 · Алгебра · 9-А`; under OWN-V2 the
  third lesson is `Інформатика · 7-А`. Mon 10-19 and Tue 10-20 in the same week
  are still served by V1. An implementation that picks the version once per week
  — or once per range — instead of once per date fails here.
- 10-22: `THU/DENOMINATOR` in OWN-V2 is `Алгебра · 9-А`; in OWN-V1 it was
  `Математика · 6-Б`.

### 2026-W44 — `NUMERATOR`, full break week

| Date | Day | `isNonTeaching` | `lessons` |
|---|---|---|---|
| 2026-10-26 | Mon | `true` (P2) | ⊘ |
| 2026-10-27 | Tue | `true` (P2) | ⊘ |
| 2026-10-28 | Wed | `true` (P2) | ⊘ |
| 2026-10-29 | Thu | `true` (P2) | ⊘ |
| 2026-10-30 | Fri | `true` (P2, R1 also matches) | ⊘ |
| 2026-10-31 | Sat | `true` (P2, R2 also matches) | ⊘ |
| 2026-11-01 | Sun | `true` (P2, R3 also matches) | ⊘ |

Every day of the week carries `parity: NUMERATOR` even though nothing is taught.
Overlapping reasons are not an error: the check is «is this date non-teaching for
any reason», one predicate (overview §4).

Note that R1 (`boundaryDate = 2026-10-26`, exclusive) stops applying **on**
2026-10-26. Fri 2026-10-30 is non-teaching because of P2 alone.

### 2026-W45 — split parity, OWN-V2

| Date | Day | `parity` | `isNonTeaching` | `lessons` |
|---|---|---|---|---|
| 2026-11-02 | Mon | `DENOMINATOR` | `false` | `1 · 08:30–09:15 · Математика · 7-А · TEMPLATE`<br>`2 · 09:25–10:10 · Алгебра · 9-А · TEMPLATE` |
| 2026-11-03 | Tue | `DENOMINATOR` | `false` | ⊘ |
| 2026-11-04 | Wed | `NUMERATOR` | `false` | `1 · 08:30–09:15 · Математика · 7-А · TEMPLATE`<br>`3 · 10:25–11:10 · Інформатика · 7-А · TEMPLATE` |
| 2026-11-05 | Thu | `NUMERATOR` | `false` | `2 · 09:25–10:10 · Фізика · 8-А · SUBSTITUTION`<br>  `replacedOriginal = Математика · 5-В` |
| 2026-11-06 | Fri | `NUMERATOR` | `false` | `1 · 08:30–09:15 · Математика · 5-В · TEMPLATE` |
| 2026-11-07 | Sat | `NUMERATOR` | `true` (R2) | ⊘ |
| 2026-11-08 | Sun | `NUMERATOR` | `true` (R3) | ⊘ |

- **11-03 is a second kind of empty day.** OWN-V2 has no `TUE/DENOMINATOR`
  slot at all, so the day is teaching, unoverridden and still empty. Three
  different routes now produce `lessons: []` — non-teaching (10-16), cleared
  (10-19), no slot (11-03) — and only the first sets `isNonTeaching`.
- **11-06 is the expired boundary.** R1 no longer applies, so the Friday slot
  renders for the first time in the window.
- 11-05 is §8.4 below.

### 2026-W46 — `DENOMINATOR` (via A2), OWN-V2

| Date | Day | `isNonTeaching` | `lessons` |
|---|---|---|---|
| 2026-11-09 | Mon | `false` | `1 · 08:30–09:15 · Математика · 7-А · TEMPLATE`<br>`2 · 09:25–10:10 · Алгебра · 9-А · TEMPLATE` |
| 2026-11-10 | Tue | `false` | `2 · 09:25–10:10 · Хімія · 8-А · SUBSTITUTION`<br>  `replacedOriginal` **absent** |
| 2026-11-11 | Wed | `false` | `1 · 08:30–09:15 · Математика · 7-А · TEMPLATE`<br>`3 · 10:25–11:10 · Інформатика · 7-А · TEMPLATE` |
| 2026-11-12 | Thu | `false` | `2 · 09:25–10:10 · Алгебра · 9-А · TEMPLATE` |
| 2026-11-13 | Fri | `false` | `1 · 08:30–09:15 · Геометрія · 9-А · TEMPLATE` |

- **11-10 is a `SUBSTITUTION` with nothing under it.** OWN-V2 has no
  `TUE/DENOMINATOR` slot (the same emptiness asserted on 11-03), so there is no
  original to strike through: `replacedOriginal` is **absent** — not `null`, not
  an empty string, and not an error. The lesson itself renders normally (§8.8).

O5 (`CLASS`, 11-09, lesson 2) does **not** touch this view: 2026-11-09 keeps
`2 · Алгебра · 9-А`.

---

## 7. Expected output — `CLASS` view

`expand(range = [2026-10-12, 2026-11-13], view = CLASS)` → the same 33
`ResolvedDay` entries as §6. Every lesson carries `isTaughtByMe`. Which dates are
non-teaching is identical to §6 — the rules are view-independent — but the tables
below are written out one row per date all the same, so that both views can be
transcribed into T-005 without expanding anything by hand.

### 2026-W42 — `NUMERATOR`, CLASS-V1

| Date | Day | `isNonTeaching` | `lessons` |
|---|---|---|---|
| 2026-10-12 | Mon | `false` | `1 · 08:30–09:15 · Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — · TEMPLATE · isTaughtByMe = true`<br>`2 · 09:25–10:10 · Українська мова · Шевченко О. П. · https://zoom.us/j/7a-ukr · — · TEMPLATE · isTaughtByMe = false` |
| 2026-10-13 | Tue | `false` | ⊘ |
| 2026-10-14 | Wed | `true` (P1) | ⊘ |
| 2026-10-15 | Thu | `false` | ⊘ |
| 2026-10-16 | Fri | `true` (R1) | ⊘ |
| 2026-10-17 | Sat | `true` (R2) | ⊘ |
| 2026-10-18 | Sun | `true` (R3) | ⊘ |

- **10-17 is O6's counterpart.** O6 is an `OWN` override, so the `CLASS` view of
  the same non-teaching Saturday stays empty. Together with 11-09 (O5) and 11-12
  (O8) this is the third pair asserting that `DayOverride` is keyed by `view`.

### 2026-W43 — `DENOMINATOR`, CLASS-V1 → gap on Wed

| Date | Day | `isNonTeaching` | `lessons` |
|---|---|---|---|
| 2026-10-19 | Mon | `false` | `1 · 08:30–09:15 · Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — · TEMPLATE · isTaughtByMe = **false**`<br>`2 · 09:25–10:10 · Українська мова · Шевченко О. П. · https://zoom.us/j/7a-ukr · — · TEMPLATE · isTaughtByMe = false` |
| 2026-10-20 | Tue | `false` | ⊘ |
| 2026-10-21 | Wed | `false` | ⊘ (gap) |
| 2026-10-22 | Thu | `false` | `1 · 08:30–09:15 · Виховна година · Шевченко О. П. · — · «замість уроків» · EDIT · isTaughtByMe = false` |
| 2026-10-23 | Fri | `true` (R1) | ⊘ |
| 2026-10-24 | Sat | `true` (R2) | ⊘ |
| 2026-10-25 | Sun | `true` (R3) | ⊘ |

- **10-19 shows that `isTaughtByMe` is a per-date fact, not a per-template one.**
  O2 cleared the teacher's own `1 · Математика · 7-А` that day, so the class's
  mathematics lesson at the same hour is no longer one they teach.
- **10-21 and 10-22 are the version gap.** No `CLASS` version covers them. The
  expected result is an ordinary teaching day with an empty lesson list — never
  an exception, and never a fallback to the neighbouring version (overview §3.2:
  «дірки між версіями дозволені»).
- **10-22 shows an override surviving the gap.** O4 has no slot underneath it and
  still renders: a `DayOverride` is bound to a date, not to a template version
  (overview §3.4), and specification §5.3 explicitly allows adding a lesson to a
  single day.

### 2026-W44 — full break week

| Date | Day | `isNonTeaching` | `lessons` |
|---|---|---|---|
| 2026-10-26 | Mon | `true` (P2) | ⊘ |
| 2026-10-27 | Tue | `true` (P2) | ⊘ |
| 2026-10-28 | Wed | `true` (P2) | ⊘ |
| 2026-10-29 | Thu | `true` (P2) | ⊘ |
| 2026-10-30 | Fri | `true` (P2) | ⊘ |
| 2026-10-31 | Sat | `true` (P2, R2 also matches) | ⊘ |
| 2026-11-01 | Sun | `true` (P2, R3 also matches) | ⊘ |

All seven carry `parity: NUMERATOR`, exactly as in §6. No `CLASS` version covers
10-26 … 11-01 either (the gap runs to 11-02), so the week is empty for two
independent reasons — and would still be empty if either one were removed.

### 2026-W45 — split parity, CLASS-V2 from Mon

| Date | Day | `parity` | `isNonTeaching` | `lessons` |
|---|---|---|---|---|
| 2026-11-02 | Mon | `DENOMINATOR` | `false` | `1 · … Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — · TEMPLATE · isTaughtByMe = true`<br>`2 · … Українська мова · Шевченко О. П. · https://zoom.us/j/7a-ukr · — · TEMPLATE · isTaughtByMe = false` |
| 2026-11-03 | Tue | `DENOMINATOR` | `false` | ⊘ |
| 2026-11-04 | Wed | `NUMERATOR` | `false` | `1 · … Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — · TEMPLATE · isTaughtByMe = true`<br>`3 · … Інформатика · Ковальчук М. І. · https://zoom.us/j/7a-it · — · TEMPLATE · isTaughtByMe = true` |
| 2026-11-05 | Thu | `NUMERATOR` | `false` | ⊘ |
| 2026-11-06 | Fri | `NUMERATOR` | `false` | `2 · 09:25–10:10 · Фізика · Ткаченко Л. В. · https://zoom.us/j/7a-phys · — · TEMPLATE · isTaughtByMe = false` |
| 2026-11-07 | Sat | `NUMERATOR` | `true` (R2) | ⊘ |
| 2026-11-08 | Sun | `NUMERATOR` | `true` (R3) | ⊘ |

- 11-05: O3 is an `OWN` override and leaves this view empty. CLASS-V2 has no
  Thursday slots.
- 11-06: the class has `FRI/2` while the teacher has `FRI/1`. Different
  `lessonNumber` → `isTaughtByMe = false`, even though both are the same date and
  the same teacher is in the building.

### 2026-W46 — `DENOMINATOR` (via A2), CLASS-V2

| Date | Day | `isNonTeaching` | `lessons` |
|---|---|---|---|
| 2026-11-09 | Mon | `false` | `1 · … Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — · TEMPLATE · isTaughtByMe = true` |
| 2026-11-10 | Tue | `false` | ⊘ |
| 2026-11-11 | Wed | `false` | `1 · … Математика · Ковальчук М. І. · https://zoom.us/j/7a-math · — · TEMPLATE · isTaughtByMe = true`<br>`3 · … Інформатика · Ковальчук М. І. · https://zoom.us/j/7a-it · — · TEMPLATE · isTaughtByMe = true` |
| 2026-11-12 | Thu | `false` | ⊘ |
| 2026-11-13 | Fri | `false` | `2 · 09:25–10:10 · Фізика · Ткаченко Л. В. · https://zoom.us/j/7a-phys · — · TEMPLATE · isTaughtByMe = false` |

- **11-12 is a `CLEARED` with nothing under it.** CLASS-V2 has no Thursday
  slots, so O8 has nothing to gag. The expected result is the unchanged empty
  day — a tombstone over an absent slot is a no-op, not an error and not a
  phantom lesson (§8.8).

2026-11-09 lost `2 · Українська мова` to O5, while §6 keeps `2 · Алгебра · 9-А`
in the `OWN` view for the same date and the same `lessonNumber`. That pair is the
assertion that `DayOverride` is keyed by `view`.

---

## 8. The scenarios, stated as assertions

### 8.1 Mid-week template version change

`OWN`, 2026-W43. Mon 10-19 and Tue 10-20 resolve against OWN-V1; Wed 10-21,
Thu 10-22 and (had it been a teaching day) Fri 10-23 resolve against OWN-V2. The
observable difference is `3 · Алгебра · 9-А` versus `3 · Інформатика · 7-А` on
Wednesday and `2 · Математика · 6-Б` versus `2 · Алгебра · 9-А` on Thursday.

`validFrom` is inclusive: 2026-10-21 belongs to the **new** version.

### 8.2 Full break week and the parity that follows

2026-W44 is non-teaching end to end. The counter still advances, so the next
teaching week (2026-W45) is `DENOMINATOR` — asserted on Mon 2026-11-02 and
Tue 2026-11-03, the only two dates in the window whose parity comes from A1
across the break.

This is the Q-001 default, not a settled truth. If Q-001 is answered
«the break week does not consume a position», those two dates become
`NUMERATOR`, the entire §5 table shifts from W45 onward, and the fix is
confined to `parity.ts` (overview §3.5). Nothing else in this document changes:
no stored row, no template, no override.

### 8.3 `ParityAnchor` reset after the break

A2 (2026-11-04 → `NUMERATOR`) makes W46 `DENOMINATOR` where the unbroken
alternation would have given `NUMERATOR`. Because A2 is not on a Monday, its own
week is split: `DENOMINATOR` on 11-02 … 11-03, `NUMERATOR` on 11-04 … 11-08.

### 8.4 `SUBSTITUTION` on a date a later version also covers

O3 was written on 2026-10-15 for 2026-11-05. At that moment:

- the version covering 2026-11-05 was OWN-V1 (then `[09-01, 12-25)`);
- the only anchor was A1, so 2026-11-05 was `DENOMINATOR`;
- OWN-V1 `THU/DENOMINATOR` lesson 2 was **`Математика · 6-Б`**.

By the time the calendar is rendered, two unrelated writes have landed —
OWN-V2 on 10-21 and A2 on 11-04. The date is now `NUMERATOR` and served by
OWN-V2, whose `THU/NUMERATOR` lesson 2 is `Математика · 5-В`.

**The pinned expectation:** on 2026-11-05 the `OWN` view shows

```
2 · 09:25–10:10 · Фізика · 8-А · SUBSTITUTION
      replacedOriginal = Математика · 5-В
```

`replacedOriginal` is `Математика · 5-В`, **not** `Математика · 6-Б`. It is
always recomputed from the version and the parity in force on the date being
rendered; it is never frozen at the moment the substitution was written
(overview §3.4: «це прийнята поведінка, не баг»). The substituted payload
itself — `Фізика · 8-А` — is stored and does not move.

Both causes of the shift are exercised at once here on purpose, and each one
alone lands somewhere else:

| What the implementation freezes | Version used | Parity used | `replacedOriginal` |
|---|---|---|---|
| nothing (correct) | OWN-V2 | `NUMERATOR` | **`Математика · 5-В`** |
| the parity, at write time | OWN-V2 | `DENOMINATOR` | `Алгебра · 9-А` |
| the version, at write time | OWN-V1 | `NUMERATOR` | `Математика · 6-Б` |
| both | OWN-V1 | `DENOMINATOR` | `Математика · 6-Б` |

Freezing the version is the weaker of the two to detect from this date alone:
OWN-V1 has the same payload in both `THU` columns, so a frozen version yields the
write-time value whether or not the parity moved with it. It is still caught here
— `Математика · 6-Б ≠ Математика · 5-В` — but a suite that wants to tell the last
two rows apart needs a second date. A single expected string on 2026-11-05
catches every one of the three wrong rows.

### 8.5 The gap between versions

`CLASS` has no version covering `[2026-10-21, 2026-11-02)`. The teaching dates in
that interval are 10-21 and 10-22 (10-23 is a methodical day, 10-24 … 11-01 are
weekend and break). Both must resolve to
`{ parity: DENOMINATOR, isNonTeaching: false, lessons: [] }` — plus O4 on 10-22 —
and must not throw, must not fall back to CLASS-V1, and must not fall forward to
CLASS-V2.

### 8.6 `OWN` and `CLASS` on the same slot

Mon 2026-11-02, lesson 1: `OWN` gives `Математика · 7-А`; `CLASS` gives
`Математика · Ковальчук М. І.` with `isTaughtByMe = true`. Same date, same
`lessonNumber`, two independent rows in two independent template versions, no
foreign key between them (overview §4).

The rule this document pins: a `CLASS` lesson has `isTaughtByMe = true` when the
**`OWN` `ResolvedDay` for the same date** contains a lesson with the same
`lessonNumber` **and the same `subject` string**. The four cases in the window
that make each condition necessary:

| Date | Lesson | Result | What it proves |
|---|---|---|---|
| 2026-11-02 | 1 | `true` | the positive case |
| 2026-11-02 | 2 | `false` | `lessonNumber` alone is not enough — the teacher has `2 · Алгебра · 9-А` that morning while the class has `2 · Українська мова`; matching on `(weekday, lessonNumber, parity)` only would flag someone else's lesson as the teacher's own |
| 2026-10-19 | 1 | `false` | the comparison is against the **resolved** `OWN` day, not the `OWN` template — O2 cleared that lesson |
| 2026-11-06 | 2 | `false` | same date, different `lessonNumber` |

Overview §4 described the comparison as `(day, number, parity)`. That wording
produces a wrong flag on 2026-11-02 lesson 2; §4 has been corrected to name the
subject as part of the comparison, and the residual weakness of comparing
free-text subjects is recorded as **Q-006**.

### 8.7 An override on a non-teaching day

Sat 2026-10-17 is non-teaching by rule R2, and O6 puts a make-up lesson on it.
The expected `ResolvedDay` is

```
{ date: 2026-10-17, parity: NUMERATOR, isNonTeaching: true,
  lessons: [ 3 · 10:25–11:10 · Відпрацювання · 7-А · EDIT ] }
```

— `isNonTeaching: true` **and** a non-empty `lessons`. The two fields are
independent, and this is the only date in the window where that shows.

The rule, now stated in overview §3.4: `isNonTeaching` suppresses lessons with
`origin = TEMPLATE` and nothing else. Specification §3.1 («розклад на ці дні не
створюється») is about the template expanding; specification §5.3 («будь-який
окремий день можна відредагувати вручну») is about a row the teacher typed on a
date. A teacher who enters a Saturday make-up lesson, or an event on a holiday,
must see it — while the date keeps its «канікули / свято» marking, because the
day is still not a teaching day.

It follows that an implementation must not shortcut `expand()` with «if the date
is non-teaching, return an empty day» — the overrides for that date still have to
be read. The same holds for the `CLASS` view of 10-17, which stays empty only
because O6 is an `OWN` row.

### 8.8 An override with no `TemplateSlot` underneath

All three `kind`s occur in the window with nothing underneath them, and the three
behave differently:

| Override | Date | What is under it | Expected |
|---|---|---|---|
| O4 `EDIT` | 2026-10-22 `CLASS` | nothing (version gap) | renders as an ordinary added lesson |
| O7 `SUBSTITUTION` | 2026-11-10 `OWN` | nothing (no slot for that parity) | renders; **`replacedOriginal` absent** |
| O8 `CLEARED` | 2026-11-12 `CLASS` | nothing (no slot that weekday) | **no-op** — the day stays `lessons: []` |

None of the three is an error. `replacedOriginal` is computed, never stored
(glossary: «обчислюється з шаблону, не зберігається»), so «no slot under the
substitution» simply means there is no field — not `null`, not an empty string. A `CLEARED` tombstone over an absent
slot gags nothing and must not itself become a lesson.

O7 is the counterpart of O3: same `kind`, same view, one with an original under
it and one without. A renderer that assumes `replacedOriginal` is always present
under a `SUBSTITUTION` fails on 2026-11-10 and nowhere else in this window.

---

## 9. Findings — what the paper exercise changed

Overview §11 asked for this walkthrough as a cheap way to catch errors in the
§3.2 invariants before any data exists. It caught four things.

**F-1 — a `ParityAnchor` that is not on a Monday splits its own week.**
Consequence of the §3.5 formula, reproduced on 2026-W45. Accepted as correct: the
teacher asked for the reset to take effect from a date, and it does. The weekly
calendar view (T-007) is the place that must cope — a week header reading
«чисельник» or «знаменник» is wrong for such a week, so the parity badge belongs
on the day, or the header must be able to show both. Recorded here so T-007 does
not discover it in the UI.

**F-2 — `isTaughtByMe` cannot be decided from `(weekday, lessonNumber, parity)`.**
Found on 2026-11-02 lesson 2. Overview §4 corrected to compare the subject as
well, against the resolved `OWN` day. The remaining hole — two different
teachers, the same subject, the same slot, one of them the user — needs either
free-text subject comparison (accepted risk) or an explicit flag on the `CLASS`
slot. Opened as **Q-006** rather than decided here, because option two is a
column and therefore touches T-003 and T-004.

**F-3 — `NonTeachingWeekdayRule` has an end but no beginning.**
Overview §4 gives the rule a weekday and a resolved boundary, nothing else. A
rule therefore applies to *every* date before `boundaryDate`, including dates in
the past: entering a methodical day in October silently turns every past Friday
non-teaching, which contradicts specification §5.2 («історія не переписується»).
This fixture sidesteps it by declaring R1–R3 during year setup, before the
window. T-003 has gained an acceptance criterion to give the rule a `validFrom`
resolved at write time, exactly as `ScheduleTemplate.validFrom` is.

Related: the model has no implicit weekend. Saturdays and Sundays are
non-teaching in this fixture only because R2 and R3 say so. Year setup (T-009)
must create them, or `expand()` must treat Sat/Sun specially — this document
assumes the former.

**F-5 — nothing said whether a non-teaching day suppresses an override.**
Overview §4 defines `isNonTeaching` as one predicate over the date and §3.4 binds
`DayOverride` to a date, but no document said what happens when both apply, and
the two specification clauses pull opposite ways: §3.1 «розклад на ці дні не
створюється» against §5.3 «будь-який окремий день можна відредагувати вручну».
Resolved in overview §3.4: `isNonTeaching` suppresses `origin = TEMPLATE` only,
so a `ResolvedDay` may carry `isNonTeaching: true` together with a non-empty
`lessons`. O6 (Sat 2026-10-17) was added to this fixture to pin it. The `expand()`
sketch in overview §3.1 had the defect written into it — its first line short-cut
a non-teaching date to «порожньо» before the `DayOverride` step was ever reached —
and has been corrected in the same commit; it now also spells out the three
«no slot in force» branches, which the fixture reaches through both a version gap
and an absent slot. The same
paragraph also states the two «nothing underneath» cases (§8.8), which were
equally unstated: a `SUBSTITUTION` without an original has no `replacedOriginal`
field, and a `CLEARED` over an absent slot is a no-op.

**F-4 — `boundaryDate` needed an inclusivity rule.**
`ScheduleTemplate.validTo` is exclusive by construction (`daterange`), but
nothing said which way `NonTeachingWeekdayRule.boundaryDate` pointed. Fri
2026-10-23 versus Fri 2026-11-06 cannot both be right. Overview §8.1 now states
that `boundaryDate` is exclusive everywhere, so a `NEXT_BREAK` boundary resolves
to the break's first day and the rule stops there.

---

## 10. What T-005 and T-004 take from here

**T-005 (Vitest).** Every table in §5, §6 and §7 is an expectation. The suite
should be organised as: `parity.ts` against §5 (including the two Q-001 dates and
the split week), `calendarRules.ts` against the `isNonTeaching` column, and
`expand.ts` against the full `ResolvedDay[]` for both views over
`[2026-10-12, 2026-11-13]`. Both §6 and §7 are written one row per date, so the
33 expectations of each view transcribe directly; nothing in them needs expanding
by hand.

Six dates are worth a named test of their own:

| Date | View | What fails without it |
|---|---|---|
| 2026-10-16 | either | an empty day whose emptiness comes from a weekday rule |
| 2026-10-19 | `OWN` | `CLEARED` confused with non-teaching |
| 2026-10-21 | `CLASS` | a version gap that throws or falls back to a neighbour |
| 2026-11-03 | `OWN` | an absent slot treated as an error |
| 2026-11-05 | `OWN` | `replacedOriginal` frozen at write time (§8.4) |
| 2026-10-17 | `OWN` | `expand()` short-circuiting on a non-teaching date (§8.7) |

and 2026-11-10 / 2026-11-12 cover the two «nothing underneath» cases of §8.8.
The first four are the four routes to `lessons: []`; 10-17 is the inverse — the
one date where `isNonTeaching: true` must not produce one.

**T-004 (seed).** §3 is the seed's content, and §3.8 is the order to write it in
if the seed exercises copy-on-write rather than inserting the final intervals
directly. Inserting OWN-V1 with `validTo = 2026-10-21` straight away is fine and
simpler; it just does not test I2.

**T-003 (schema).** F-3 and F-4 are the two items this document sends onward.
