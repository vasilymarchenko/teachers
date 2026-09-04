import { describe, expect, it } from "vitest";
import { parityEnum, weekdayEnum } from "@/lib/db/schema/enums";
import { TEMPLATE_SLOT_FIELDS } from "@/lib/validation/templateDay";
import {
  COPY_LABELS,
  DAY_LABELS,
  FIELD_LABELS,
  lessonRowLabel,
  SHORT_WEEKDAY_LABELS,
  WEEKDAY_LABELS,
} from "./labels";

/**
 * Every value the template editor can show has a Ukrainian word for it.
 *
 * A missing entry is not a crash but an unlabelled input, which on this screen
 * is a cell the teacher cannot tell from the one beside it. The suite has no
 * DOM, so this is what stands in for rendering the grid — the trade T-009's
 * labels test makes for the same reason.
 */

describe("the template editor's labels", () => {
  it("names every field of both views", () => {
    for (const view of ["OWN", "CLASS"] as const) {
      for (const field of TEMPLATE_SLOT_FIELDS[view]) {
        expect(FIELD_LABELS[field], `${view}.${field}`).toBeTruthy();
      }
    }
  });

  it("names every weekday, long and short", () => {
    for (const weekday of weekdayEnum.enumValues) {
      expect(WEEKDAY_LABELS[weekday], weekday).toBeTruthy();
      expect(SHORT_WEEKDAY_LABELS[weekday], weekday).toBeTruthy();
      // Two characters is what fits seven buttons across 390 px.
      expect(SHORT_WEEKDAY_LABELS[weekday]).toHaveLength(2);
    }
  });

  it("names the copy action in both directions", () => {
    for (const parity of parityEnum.enumValues) {
      expect(COPY_LABELS[parity], parity).toBeTruthy();
    }
    expect(COPY_LABELS.NUMERATOR).not.toBe(COPY_LABELS.DENOMINATOR);
  });

  it("tells one lesson's input from another's for a screen reader", () => {
    // Seven columns of «Предмет» are one word repeated; the lesson number is
    // what tells them apart.
    expect(DAY_LABELS.field(3, "subject")).toContain("3");
    expect(DAY_LABELS.field(3, "subject")).not.toBe(
      DAY_LABELS.field(4, "subject"),
    );
  });
});

describe("lessonRowLabel", () => {
  it("shows the number and the start time — specification §5.1", () => {
    expect(
      lessonRowLabel({ lessonNumber: 3, timeFrom: "10:15", timeTo: "11:00" }),
    ).toBe("3 · 10:15");
  });

  it("shows the number alone when that lesson has no bell", () => {
    expect(lessonRowLabel({ lessonNumber: 8 })).toBe("8");
  });
});
