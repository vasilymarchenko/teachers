---
id: ADR-021
title: A template day save may cover both parity weeks, without a «both» value of parity
status: superseded by ADR-025
date: 2026-10-01
ticket: T-043
---

## Context

ADR-006 made the day the unit of a template save: one `<form>` is one
`weekday` × one `parity` × one `view`. Teacher feedback on `/schedule`: the
numerator and the denominator week usually differ in one or two lessons, and
sometimes not at all. With one parity per save, every lesson the two weeks
share is typed twice, and «скопіювати з чисельника» (specification §5.1) helps
only once — after the copy, each later change to a shared lesson is again two
saves. Specification §5.1 now asks for a day to be filled once for both weeks.

`template_slot.parity` is `NUMERATOR | DENOMINATOR`, and the schema comment
says there is no «both». `expand()` reads one parity's slots for a date.

## Options

**A `BOTH` value of `parity`.** One row serves both weeks. Costs: a migration
of the enum and of `template_slot_cell_uq`; `expand()` and every query over
slots learn a third value; editing one week of a `BOTH` cell has to split the
row into two, so the editor gains a write that no other edit has; and the
uniqueness of a cell stops being a plain constraint, because a `BOTH` row and
a `NUMERATOR` row for the same cell must not coexist.

**A switch for the whole template** — «чисельник і знаменник однакові» shows
one grid that writes both weeks. Costs: the usual case is one or two lessons
apart, so the switch is off after the first difference, and the teacher is
back to two grids for the rest of the year.

**The day form writes one or both parities.** A checkbox on the day form; on,
the save replaces this weekday in both parity weeks. Costs: one more input on
every day form, and the form has to show where the weeks differ, or the
checkbox silently overwrites a difference the teacher cannot see.

## Decision

**The unit of a template save is one `weekday` × one `view` × one or both
parities.** The day form carries «Однаково для обох тижнів»; with it on,
`saveTemplateDayAction()` replaces the weekday in both parity weeks through a
single `applyTemplateEdit()` call, so the two halves are written in one
transaction or not at all. The checkbox defaults to on exactly when the two
weeks of that weekday are equal, and each row that differs shows the other
week's content.

`parity` keeps its two values, and a day saved for both weeks is two sets of
rows. Everything else in ADR-006's decision — every write through
`planTemplateEdit()`, the boundary as copy-on-write, `capToNextVersion()` —
holds unchanged.

## Consequences

Nothing below the action changes: no migration, no change to `expand()`, and
the version rule of ADR-006 (at most one version per view per day of editing)
still holds.

The rows stay duplicated for equal weeks. That is the cost taken knowingly: it
is a few dozen rows per version, and it keeps every reader of slots unaware
that a «both» exists.

Revisit if a third parity-like dimension appears (a cycle longer than two
weeks), or if a reader other than the editor ever needs to know that two
weeks were entered as one — then a stored marker earns its migration.

When T-043 lands, this ADR becomes `accepted` and ADR-006 becomes
`superseded by ADR-021`.
