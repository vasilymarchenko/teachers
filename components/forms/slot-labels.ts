import type { SlotFieldName } from "@/lib/validation/slotFields";

/**
 * What a lesson's fields are called on screen — specification §5.1, its three
 * and its five.
 *
 * Here rather than in one screen's labels because two screens write a lesson:
 * the weekly template editor (T-010) and the day-override editor (T-011). The
 * fields are the same fields (`lib/validation/slotFields.ts`), so «ПІБ учителя»
 * is one word in one place; a second wording of a product term is how one term
 * becomes two.
 *
 * Ukrainian — the teacher reads it (root `CLAUDE.md`, language by audience).
 */
export const SLOT_FIELD_LABELS: Record<SlotFieldName, string> = {
  subject: "Предмет",
  className: "Клас",
  teacherName: "ПІБ учителя",
  zoomLink: "Посилання на Zoom",
  note: "Додаткова інформація",
};

/**
 * The label of one input when the screen shows several lessons at once: a
 * screen reader otherwise hears «Предмет» once per column with nothing to tell
 * the columns apart.
 */
export function slotFieldLabel(
  lessonNumber: number,
  field: SlotFieldName,
): string {
  return `Урок ${lessonNumber}, ${SLOT_FIELD_LABELS[field].toLowerCase()}`;
}
