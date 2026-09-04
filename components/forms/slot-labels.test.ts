import { describe, expect, it } from "vitest";
import { scheduleViewEnum } from "@/lib/db/schema/enums";
import { SLOT_FIELDS } from "@/lib/validation/slotFields";
import { SLOT_FIELD_LABELS, slotFieldLabel } from "./slot-labels";

/**
 * Every field a lesson is written with has a Ukrainian word for it, in both
 * views and therefore on both screens that write one — the weekly template
 * editor (T-010) and the day-override editor (T-011).
 *
 * A missing entry is not a crash but an unlabelled input, which is a cell the
 * teacher cannot tell from the one beside it. The suite has no DOM, so this is
 * what stands in for rendering the form.
 */

describe("the labels of a lesson's fields", () => {
  it("names every field of both views", () => {
    for (const view of scheduleViewEnum.enumValues) {
      for (const field of SLOT_FIELDS[view]) {
        expect(SLOT_FIELD_LABELS[field], `${view}.${field}`).toBeTruthy();
      }
    }
  });

  it("names the lesson a field belongs to, for the screens showing several", () => {
    expect(slotFieldLabel(3, "subject")).toBe("Урок 3, предмет");
    expect(slotFieldLabel(0, "teacherName")).toBe("Урок 0, піб учителя");
  });
});
