import { describe, expect, it } from "vitest";
import {
  bellField,
  bellFieldErrors,
  bellScheduleInput,
} from "./bellSchedule";
import { LESSON_NUMBERS } from "./enums";

/**
 * Specification §3.3 as the form's boundary — ten rows, most of them empty.
 *
 * The grid is the one form here whose field names are computed, so the mapping
 * is tested from both ends: `bellField()` produces the name and
 * `bellFieldErrors()` puts the issue back on it.
 */

/** The grid with every row empty, which is a legal submission. */
const emptyGrid = LESSON_NUMBERS.map((lessonNumber) => ({
  lessonNumber,
  timeFrom: "",
  timeTo: "",
}));

const withRow = (lessonNumber: number, timeFrom: string, timeTo: string) =>
  emptyGrid.map((row) =>
    row.lessonNumber === lessonNumber ? { lessonNumber, timeFrom, timeTo } : row,
  );

const errorsFor = (bells: unknown) => {
  const parsed = bellScheduleInput.safeParse({ bells });
  return parsed.success ? {} : bellFieldErrors(parsed.error);
};

describe("bellScheduleInput", () => {
  it("accepts the fixture's five bells and five empty rows", () => {
    // Fixtures §3.4 — 1 … 5 defined, 0 and 6 … 9 absent.
    const bells = emptyGrid.map((row) => {
      const times: Record<number, [string, string]> = {
        1: ["08:30", "09:15"],
        2: ["09:25", "10:10"],
        3: ["10:25", "11:10"],
        4: ["11:20", "12:05"],
        5: ["12:15", "13:00"],
      };
      const pair = times[row.lessonNumber];
      return pair ? { ...row, timeFrom: pair[0], timeTo: pair[1] } : row;
    });

    expect(bellScheduleInput.safeParse({ bells }).success).toBe(true);
  });

  it("accepts a grid with nothing filled in", () => {
    // A teacher who has not entered bells yet has no rows, and `expand()`
    // leaves the times off the lesson (fixtures §3.4).
    expect(bellScheduleInput.safeParse({ bells: emptyGrid }).success).toBe(true);
  });

  it("accepts lesson 0, which is a real lesson number", () => {
    expect(
      bellScheduleInput.safeParse({ bells: withRow(0, "07:40", "08:25") }).success,
    ).toBe(true);
  });

  it("requires both times or neither", () => {
    expect(errorsFor(withRow(3, "10:25", ""))).toStrictEqual({
      [bellField(3, "to")]: "Вкажіть початок і кінець уроку або залиште рядок порожнім",
    });
    expect(errorsFor(withRow(3, "", "11:10"))).toStrictEqual({
      [bellField(3, "from")]: "Вкажіть початок і кінець уроку або залиште рядок порожнім",
    });
  });

  it("rejects a lesson that ends before it starts", () => {
    // `bell_schedule_times_ck` — `time_from < time_to`.
    expect(errorsFor(withRow(2, "10:10", "09:25"))).toStrictEqual({
      [bellField(2, "to")]: "Кінець уроку має бути пізніше за його початок",
    });
  });

  it("rejects a lesson of zero length", () => {
    expect(errorsFor(withRow(2, "09:25", "09:25"))).toStrictEqual({
      [bellField(2, "to")]: "Кінець уроку має бути пізніше за його початок",
    });
  });

  it("rejects a time that is not HH:MM", () => {
    expect(errorsFor(withRow(1, "8:30", "09:15"))).toStrictEqual({
      [bellField(1, "from")]: "Час має бути у форматі ГГ:ХХ",
    });
  });

  it("rejects seconds, which the column does not carry", () => {
    // `time_from`/`time_to` are read back as HH:MM (`getBellSchedule()`), and
    // the form must submit what the domain reads.
    expect(errorsFor(withRow(1, "08:30:00", "09:15"))).toStrictEqual({
      [bellField(1, "from")]: "Час має бути у форматі ГГ:ХХ",
    });
  });

  it("reports every broken row, not just the first", () => {
    const bells = emptyGrid.map((row) =>
      row.lessonNumber === 1
        ? { ...row, timeFrom: "08:30", timeTo: "08:00" }
        : row.lessonNumber === 4
          ? { ...row, timeFrom: "bad", timeTo: "12:05" }
          : row,
    );

    expect(errorsFor(bells)).toStrictEqual({
      [bellField(1, "to")]: "Кінець уроку має бути пізніше за його початок",
      [bellField(4, "from")]: "Час має бути у форматі ГГ:ХХ",
    });
  });

  it("refuses a grid that is not all ten lesson numbers", () => {
    // `bellFieldErrors()` reads the lesson number off the array index, which is
    // only sound while every submission carries all ten rows in order.
    const parsed = bellScheduleInput.safeParse({ bells: emptyGrid.slice(0, 5) });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe("Розклад дзвінків має містити уроки 0–9");
  });
});

describe("bellField()", () => {
  it("names the two inputs of a row distinctly", () => {
    expect(bellField(0, "from")).toBe("bell-0-from");
    expect(bellField(9, "to")).toBe("bell-9-to");
  });
});
