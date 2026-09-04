import type {
  BellInput,
  TemplateSlotInput,
} from "@/lib/domain/schedule/types";

/**
 * Which lesson numbers the template editor shows as rows.
 *
 * The `BellSchedule` decides: it is where the teacher says which lessons the
 * school day has, and specification §5.1 wants the row to read «3 · 10:15» —
 * the number *and* the time it starts. So the rows are the bell rows, in
 * numeric order.
 *
 * Two properties matter and both are the point of this function:
 *
 *  - **numbers are not renumbered.** A school with bells on 1, 2 and 5 gets
 *    rows 1, 2 and 5. The gap is real — lessons 3 and 4 do not exist there —
 *    and closing it would relabel the fifth lesson as the third;
 *  - **a slot without a bell is still shown.** Deleting a bell row afterwards
 *    would otherwise hide a lesson that is still in the template and still in
 *    the calendar, with no way to reach it. It appears without a time, which is
 *    exactly what `expand()` does with it (fixtures §3.4).
 *
 * The rows are computed from **every** slot of the version, not from the day
 * being edited, so all seven days line up on the same rows.
 */

export type LessonRow = {
  lessonNumber: number;
  /** From the `BellSchedule`; absent for a number with no bell row. */
  timeFrom?: string;
  timeTo?: string;
};

export function lessonRows(
  bells: readonly BellInput[],
  slots: readonly TemplateSlotInput[],
): LessonRow[] {
  const rows = new Map<number, LessonRow>();

  for (const slot of slots) {
    rows.set(slot.lessonNumber, { lessonNumber: slot.lessonNumber });
  }
  for (const bell of bells) {
    rows.set(bell.lessonNumber, {
      lessonNumber: bell.lessonNumber,
      timeFrom: bell.timeFrom,
      timeTo: bell.timeTo,
    });
  }

  return [...rows.values()].sort((a, b) => a.lessonNumber - b.lessonNumber);
}
