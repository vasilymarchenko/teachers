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

## Options

**A checkbox per day (ADR-021).** Rejected by the sequence above: no setting
of it carries one lesson across without either retyping or overwriting.

**A toggle per lesson row, off by default.** A save writes into the other week
only the rows the teacher switched on. Nothing is ever carried across
unasked. Costs: a new day equal in both weeks is switched on row by row, and
a change meant for both weeks — a subject replaced for the year — is made
twice whenever the toggle is forgotten.

**A toggle per lesson row, on by default where the row is equal in both
weeks.** A row reads as one lesson shared by the two weeks until the teacher
separates it. Costs: a change meant for one week only, made on a row that is
still shared, reaches the other week unless the toggle is switched off first.
The form mitigates that by showing the toggle on every row and by saying, on
a row that is about to be written into the other week, what it will replace
there.

## Decision

**A toggle per lesson row, on by default exactly when that `weekday` ×
`lessonNumber` is equal in both parity weeks — both empty included.** The
unit of a template save is one `weekday` × one `view`; the week on the screen
is replaced at the rows the form rendered, as ADR-006 has it, and the other
parity week is written only at the rows whose toggle is on — with the same
payload, or removed if the row was emptied. Rows whose toggle is off leave the
other week untouched. Both halves go through one `applyTemplateEdit()` call.

`parity` keeps its two values; a lesson shared by both weeks is two rows, and
nothing stores that it was entered once. «Скопіювати з чисельника» stays as
the whole-week action.

## Consequences

No migration, no change to `expand()` or to any reader of slots; ADR-006's
copy-on-write rules hold unchanged, so one save is still at most one version
per view per day of editing.

The day form gains one input per row, read as a boolean per lesson number,
and loses the day-level checkbox ADR-021 would have added. The toggle shares
the row header with the row's other actions.

Revisit if teachers report one-week edits leaking into the other week — that
is the cost this default accepts, and the evidence would argue for the
off-by-default option above.

ADR-021 is superseded by this record. When T-043 lands, this ADR becomes
`accepted` and ADR-006 becomes `superseded by ADR-025`.
