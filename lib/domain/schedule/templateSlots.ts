import type { Parity, Weekday } from "@/lib/db/schema/enums";
import type { SlotPayload } from "@/lib/validation/slotPayload";
import type { TemplateSlotInput } from "./types";

/**
 * The ways a teacher changes the set of slots in a `ScheduleTemplate`
 * version — specification §5.1, and the `mutate` half of the write path
 * described in `docs/architecture/design/T-010-weekly-template-editor.md` §2.
 *
 * Both are pure functions over the **whole** slot set of one version, because
 * that is what copy-on-write needs: the new version carries every slot of the
 * old one except where the edit says otherwise (overview §3.2, I1). Neither
 * mutates its input — the caller still holds the old version's slots and writes
 * them nowhere.
 *
 * Neither knows about the database, the `view` or the payload's shape: a
 * payload is opaque here and is parsed on the boundary
 * (`lib/validation/slotPayload.ts`).
 */

/** Which cells of the weekly grid one form owns — one column of one week. */
export type SlotCell = { weekday: Weekday; parity: Parity };

/** The parity week that is not `parity` — `parity` has exactly two values. */
export function otherParity(parity: Parity): Parity {
  return parity === "NUMERATOR" ? "DENOMINATOR" : "NUMERATOR";
}

/**
 * The slot set with one day of one parity week replaced by `next`.
 *
 * "Replaced", not merged: `next` is the day as the form submitted it, so a
 * lesson the teacher cleared is a slot that is simply not in `next` and
 * therefore not in the result. Slots of every other weekday and of the other
 * parity are carried through untouched — the other parity is a separate set of
 * rows with no link to this one (schema §4.8, «There is no “both weeks” value»).
 *
 * **The replacement is limited to `covered`** — the lesson numbers the form
 * actually rendered. Those are the rows the teacher could see and clear, and
 * they are the only ones an empty input speaks for. A slot at a number the form
 * never showed is carried through: it may have been added in another window
 * after this page was rendered, or sit on a lesson number whose bell row was
 * deleted since. Without this the save would delete it while reporting success,
 * which is the one failure `expand()` cannot show the teacher — a lesson that
 * quietly stops existing.
 */
export function replaceDaySlots(
  slots: readonly TemplateSlotInput[],
  cell: SlotCell,
  next: readonly TemplateSlotInput[],
  covered: readonly number[],
): TemplateSlotInput[] {
  const rows = new Set(covered);
  const kept = slots.filter(
    (slot) =>
      slot.weekday !== cell.weekday ||
      slot.parity !== cell.parity ||
      !rows.has(slot.lessonNumber),
  );
  return [...kept, ...next];
}

/**
 * One save of the day form — the week on the screen, plus the rows the teacher
 * switched to «в обох тижнях» (ADR-025).
 *
 * The week on the screen is replaced at `covered`, exactly as
 * `replaceDaySlots()` does. In the other parity week only the lesson numbers in
 * `bothWeeks` are replaced — with the submitted lesson, or by its absence when
 * the row was emptied. Every other slot of the other week is carried through:
 * a row whose toggle is off is a one-week edit, whatever the two weeks hold.
 * A number in `bothWeeks` that the form did not render speaks for nothing and
 * is ignored, for the reason `covered` exists.
 *
 * `changedInOther` is the lesson numbers whose slot in the other week is not
 * what it was — what the form reports after the save. A row switched on but
 * already equal in both weeks is not among them. Equality is `same`, passed in
 * because the payload is opaque here (`sameLesson()` in
 * `lib/validation/slotFields.ts`).
 */
export function saveDaySlots(
  slots: readonly TemplateSlotInput[],
  cell: SlotCell,
  next: readonly TemplateSlotInput[],
  covered: readonly number[],
  bothWeeks: readonly number[],
  same: (a: SlotPayload | undefined, b: SlotPayload | undefined) => boolean,
): { slots: TemplateSlotInput[]; changedInOther: number[] } {
  const rows = new Set(covered);
  const linked = covered.filter((lessonNumber) => bothWeeks.includes(lessonNumber));
  const other: SlotCell = { weekday: cell.weekday, parity: otherParity(cell.parity) };

  const payloadAt = (
    set: readonly TemplateSlotInput[],
    at: SlotCell,
    lessonNumber: number,
  ): SlotPayload | undefined =>
    set.find(
      (slot) =>
        slot.weekday === at.weekday &&
        slot.parity === at.parity &&
        slot.lessonNumber === lessonNumber,
    )?.payload;

  const copied = next
    .filter((slot) => rows.has(slot.lessonNumber) && linked.includes(slot.lessonNumber))
    .map((slot) => ({ ...slot, weekday: other.weekday, parity: other.parity }));

  const changedInOther = linked.filter(
    (lessonNumber) =>
      !same(payloadAt(slots, other, lessonNumber), payloadAt(copied, other, lessonNumber)),
  );

  const own = replaceDaySlots(slots, cell, next, covered);
  return {
    slots: replaceDaySlots(own, other, copied, linked),
    changedInOther,
  };
}

/**
 * «Скопіювати з чисельника» — the whole `from` week written over the `to` week
 * (specification §5.1, glossary §3).
 *
 * The target week is **replaced**, not merged into: a lesson that exists only
 * in the denominator week disappears, which is what "copy" means and what makes
 * the action's result predictable. What follows it is editing the few cells
 * that genuinely differ — the flow the specification describes.
 *
 * The copy is a one-time insert and not a link (schema §4.8): editing the
 * numerator afterwards leaves the denominator week as this call left it.
 */
export function copyParity(
  slots: readonly TemplateSlotInput[],
  from: Parity,
  to: Parity,
): TemplateSlotInput[] {
  if (from === to) return [...slots];

  const kept = slots.filter((slot) => slot.parity !== to);
  const copied = slots
    .filter((slot) => slot.parity === from)
    .map((slot) => ({ ...slot, parity: to }));

  return [...kept, ...copied];
}
