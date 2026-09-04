import { describe, expect, it } from "vitest";
import type {
  BellInput,
  TemplateSlotInput,
} from "@/lib/domain/schedule/types";
import { lessonRows } from "./lessonRows";

/**
 * The rows of the template editor — specification §5.1 and §3.3.
 */

const bell = (lessonNumber: number, timeFrom: string, timeTo: string): BellInput => ({
  lessonNumber,
  timeFrom,
  timeTo,
});

const slot = (lessonNumber: number): TemplateSlotInput => ({
  weekday: "MON",
  lessonNumber,
  parity: "NUMERATOR",
  payload: { subject: "Математика", className: "7-А" },
});

describe("lessonRows", () => {
  it("carries the bell time onto the row, which is what «3 · 10:15» needs", () => {
    expect(lessonRows([bell(3, "10:15", "11:00")], [])).toEqual([
      { lessonNumber: 3, timeFrom: "10:15", timeTo: "11:00" },
    ]);
  });

  it("keeps the gaps in the numbering instead of closing them", () => {
    // A school whose bells are 1, 2 and 5 has no third lesson. Renumbering
    // would turn the fifth into the third on the screen and nowhere else.
    const bells = [
      bell(1, "08:30", "09:15"),
      bell(2, "09:25", "10:10"),
      bell(5, "12:20", "13:05"),
    ];

    expect(lessonRows(bells, []).map((row) => row.lessonNumber)).toEqual([1, 2, 5]);
  });

  it("shows a slot whose bell row is gone, without a time", () => {
    // Otherwise a lesson still in the template and still in the calendar would
    // be unreachable from the editor.
    expect(lessonRows([bell(1, "08:30", "09:15")], [slot(8)])).toEqual([
      { lessonNumber: 1, timeFrom: "08:30", timeTo: "09:15" },
      { lessonNumber: 8 },
    ]);
  });

  it("does not repeat a number that has both a bell and a slot", () => {
    expect(lessonRows([bell(1, "08:30", "09:15")], [slot(1)])).toEqual([
      { lessonNumber: 1, timeFrom: "08:30", timeTo: "09:15" },
    ]);
  });

  it("orders by lesson number, whatever order it was given", () => {
    const bells = [bell(2, "09:25", "10:10"), bell(0, "07:40", "08:25")];

    expect(lessonRows(bells, [slot(1)]).map((row) => row.lessonNumber)).toEqual([
      0, 1, 2,
    ]);
  });

  it("has no rows at all when there are no bells and no slots", () => {
    // The screen answers this with «заповніть розклад дзвінків», not with ten
    // nameless rows.
    expect(lessonRows([], [])).toEqual([]);
  });
});
