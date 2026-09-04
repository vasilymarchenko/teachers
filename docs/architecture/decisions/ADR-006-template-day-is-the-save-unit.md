---
id: ADR-006
title: One weekday is the unit of a template save, and every write is copy-on-write
status: accepted
date: 2026-09-04
ticket: T-010
---

## Context

The weekly template editor is the screen invariant I1 of
`architect-overview.md` §3.2 was written about: *«природний UI — відкрив
тижневий шаблон, змінив клітинку, зберіг — мовчки перепише минуле»*. The
invariant says an edit never updates the version in force; it cuts that version
at `today()` and carries its slots into a new one. `planTemplateEdit()` (T-005)
plans those rows, and `EXCLUDE USING gist` (I3) refuses an overlap. What none of
that fixes is the shape of the screen, and the shape decides two things the
teacher feels.

**What one «Зберегти» covers.** A new version copies **every** slot of the one
in force, so the size of a save is not the size of the write — it is how much
the teacher can lose to one refusal, how many versions a day of editing
produces, and how many forms one screen carries.

**Whether the screen is one thing on a phone and another on a desktop.** Q-002
(overview §10.2) closed before any UI existed, precisely so this editor would
not have to be rewritten: below the tablet breakpoint the teacher works one day
at a time, above it the week is a grid. That answer constrains the save unit,
because a `<form>` is a subtree of the DOM — whatever a form covers has to be a
thing that exists in both layouts.

Three further edits go through the same table: «скопіювати з чисельника»
(specification §5.1), «доки діє цей розклад» (§5.1, overview §8.1), and clearing
a lesson from the template. Each could reasonably have had its own write path.

## Options

**The cell.** One form per `weekday` × `lessonNumber` × `parity`. Smallest
possible loss on a refusal, and it matches the row-per-form shape of the
year-setup screens. Costs: the desktop grid is ~60 live forms, each with its own
`useActionState`; filling an empty week is one submission per cell; and the
mobile layout is a different arrangement of the *same* forms, which is fine, but
the thing a teacher thinks of as «понеділок» exists in neither layout as an
object.

**The whole grid.** One form for a view and a parity week. Fewest versions, one
button. Costs: on a phone the grid does not exist, so this form has no mobile
counterpart at all and the day-centric flow would need a second write path;
a field error has to be found among ~120 inputs; and the submission carries
every cell whether or not the teacher touched it.

**The day.** One form per `weekday` × `parity` × `view`. It is exactly the unit
Q-002 chose for the narrow screen, so the mobile editor is one instance of the
component and the desktop grid is seven of them side by side — the wrapper is
the grid, the day is the component. Costs: seven forms rather than one, and a
save carries the whole day even when one cell changed.

**For the boundary, additionally:** update `valid_to` on the version in force in
place. Moving the end of a version does not rewrite its past, so this is not a
violation of I1 on its face, and it produces no extra row.

## Decision

**The day is the unit of saving.** One `<form>` is one `weekday` × one `parity`
× one `view`; `saveTemplateDayAction()` takes those three plus the lesson
numbers the screen showed. An empty row is the absence of a slot, so the same
submission creates, updates and deletes.

**Every write goes through `planTemplateEdit()`** — the day form, «скопіювати з
чисельника» and «доки діє цей розклад» alike. They differ only in a pure
function over the version's slots (`lib/domain/schedule/templateSlots.ts`), and
`applyTemplateEdit()` in `lib/actions/scheduleTemplate.ts` is the single write
path. In particular the boundary is **not** the exception the fourth option
offers: an in-place `UPDATE` of `valid_to` would be the one write in the
application able to move a version's end backwards over days that have already
been taught, and it would need its own guard for exactly the case I1 exists to
make unreachable.

**The new version stops where a later one starts** (`capToNextVersion()`).
`planTemplateEdit()` plans against the version in force and says that a version
beginning after the cut is the editor's to handle; this is the editor handling
it.

## Consequences

The mobile editor and the desktop grid are the same component, which is what
Q-002 was closed early to buy — the grid is a wrapper over seven days, and
adapting it to 390 px is a CSS decision, not a rewrite.

One code path carries I1, so there is nothing to keep in step: a reviewer checks
`applyTemplateEdit()` and has checked every write on the screen. The cut date
cannot arrive from a form, because no action takes one.

At most one version per view per day of editing, whatever the teacher does:
the first save cuts and inserts, and every later save that day lands in the
version that now starts today (`schema.md` §4.7, the `replace` branch). A week
filled in from scratch produces one version, not thirty.

The costs, taken knowingly: a save rewrites all of the version's slots, so two
windows editing different days of the same week are a genuine conflict rather
than a merge — I3 refuses the second and the teacher is told to reload. Moving
the boundary leaves a version behind whose slots are identical to its
successor's. And a day form submits cells the teacher did not touch, so a value
that fails validation blocks the day rather than the cell.

**Revisit if** either cost starts biting: if the version list grows long enough
that the strip on the screen becomes unreadable, or if two people ever edit one
teacher's schedule at once — the second is the multi-tenant step of overview §7,
and it would make the per-day conflict a daily event rather than a rarity.
