---
id: ADR-025
title: Whether a template save covers both parity weeks is decided per lesson row, not per day
status: proposed
date: 2026-10-04
ticket: T-043
---

## Context

ADR-021 (proposed, never implemented) let one template day save write both
parity weeks, under a checkbox on the day form: on, the save replaces the
weekday in both weeks; off, only in the week on the screen. Its rejection of
a `BOTH` value of `parity` and of a whole-template switch stands, and is not
repeated here.

Walking a real sequence of edits through it broke the day-level checkbox:

1. The teacher fills Monday once for both weeks.
2. They change two lessons in the denominator week only. The two Mondays now
   differ, so the checkbox opens off.
3. They add a lesson to the numerator Monday and want that one lesson in the
   denominator too.

With the checkbox off the lesson is typed again in the other week; with it on
the denominator Monday is replaced whole and step 2 is lost. The two weeks
differ by single lessons, so a choice made for the whole day is wrong exactly
in the case the feature exists for.

The specification's other way to fill the second week is «скопіювати з
чисельника», then edit the cells that differ (specification §5.1). Any per-row
choice has to leave that flow working: right after a copy every row of the two
weeks is equal, and the edits that follow are one-week edits by definition.

## Options

**A checkbox per day (ADR-021).** Rejected by the sequence above: no setting
of it carries one lesson across without either retyping or overwriting.

**A toggle per lesson row, on by default where the row is equal in both
weeks.** A row reads as one lesson shared by the two weeks until the teacher
separates it, so a new day equal in both weeks is filled once and a change
meant for both weeks is made once. Rejected: equal is not the same as shared,
and nothing stored tells them apart. Right after «скопіювати з чисельника»
every row is equal, so every toggle would open on, and each edit the
specification prescribes next would be written back into the week it was
copied from — as would step 2 of the sequence above. A same-day save replaces
the version (ADR-006), so the overwritten week leaves no earlier version to
recover from. The cost lands on the specification's main flow, not on a rare
edit, and it is data lost rather than work repeated.

**A toggle per lesson row, off by default.** A save writes into the other week
only the rows the teacher switched on. Nothing is carried across unasked.
Costs: a change meant for both weeks — a subject replaced for the year — is
made twice whenever the toggle is forgotten, and a new day equal in both weeks
is filled through «скопіювати з чисельника» or row by row with the toggle on.
A forgotten toggle costs retyping one lesson; nothing is overwritten.

## Decision

**A toggle per lesson row, off whenever the form opens.** The unit of a
template save is one `weekday` × one `view`; the week on the screen is
replaced at the rows the form rendered, as ADR-006 has it, and the other
parity week is written only at the rows whose toggle is on — with the same
payload, or removed if the row was emptied. Rows whose toggle is off leave the
other week untouched. Both halves go through one `applyTemplateEdit()` call.

`parity` keeps its two values; a lesson shared by both weeks is two rows, and
nothing stores that it was entered once. «Скопіювати з чисельника» stays as
the whole-week action.

## Consequences

No migration, no change to `expand()` or to any reader of slots. This record
changes only the save unit of ADR-006; everything else ADR-006 decides holds
as written there, and ADR-006 stays `accepted`. One save is still at most one
version per view per day of editing.

The day form gains one input per row, read as a boolean per lesson number,
and loses the day-level checkbox ADR-021 would have added. The toggle sits in
the row's header line. `FormState` gains an optional message about a
successful submission, which carries the after-save report of what the save
wrote into the other week.

Revisit if teachers report retyping the same change in both weeks because the
toggle was forgotten — that is the cost this default accepts. The answer is
not the on-by-default option above, which fails on the copy flow, but storing
that a row is shared, which this record does not do.

ADR-021 is superseded by this record. When T-043 lands, this ADR becomes
`accepted`.
