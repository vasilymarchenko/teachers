import { describe, expect, it } from "vitest";
import {
  BELL_SCHEDULE_FIELD,
  bellField,
  bellFieldErrors,
  bellScheduleInput,
  parseLessonMinutes,
} from "./bellSchedule";
import { LESSON_NUMBERS } from "./enums";
import { clockTimeInput } from "./fields";

/**
 * Specification §3.3 as the form's boundary — ten starts, most of them empty,
 * and one lesson length; no end of a lesson is ever submitted (T-040).
 *
 * The grid is the one form here whose field names are computed, so the mapping
 * is tested from both ends: `bellField()` produces the name and
 * `bellFieldErrors()` puts the issue back on it.
 */

const NOT_A_TIME = "Час має бути у форматі ГГ:ХХ";
const LESSON_MINUTES_RULE = "Тривалість уроку — ціле число хвилин від 10 до 90";
const PAST_MIDNIGHT = "Урок має закінчуватися не пізніше 23:59";
const STARTS_GROW = "Урок має починатися пізніше за попередній";

/** The grid with the given starts and every other row empty. */
const grid = (starts: Record<number, string> = {}) =>
  LESSON_NUMBERS.map((lessonNumber) => ({
    lessonNumber,
    timeFrom: starts[lessonNumber] ?? "",
  }));

const parse = (starts: Record<number, string>, lessonMinutes = "45") =>
  bellScheduleInput.safeParse({ lessonMinutes, bells: grid(starts) });

const errorsFor = (starts: Record<number, string>, lessonMinutes = "45") => {
  const parsed = parse(starts, lessonMinutes);
  return parsed.success ? {} : bellFieldErrors(parsed.error);
};

/** Fixtures §3.4 — 1 … 5 defined, 0 and 6 … 9 absent; each lasts 45 minutes. */
const FIXTURE_STARTS = {
  1: "08:30",
  2: "09:25",
  3: "10:25",
  4: "11:20",
  5: "12:15",
};

describe("bellScheduleInput", () => {
  it("accepts the fixture's five starts and five empty rows", () => {
    const parsed = parse(FIXTURE_STARTS);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toStrictEqual({
      lessonMinutes: 45,
      bells: grid(FIXTURE_STARTS),
    });
  });

  it("hands back no end of a lesson — the action computes it", () => {
    const parsed = parse(FIXTURE_STARTS);

    for (const bell of parsed.data?.bells ?? []) {
      expect(Object.keys(bell).sort()).toStrictEqual(["lessonNumber", "timeFrom"]);
    }
  });

  it("drops an end the request carries anyway", () => {
    const bells = grid({ 1: "08:30" }).map((bell) => ({ ...bell, timeTo: "23:00" }));
    const parsed = bellScheduleInput.safeParse({ lessonMinutes: "45", bells });

    expect(parsed.data?.bells[1]).toStrictEqual({ lessonNumber: 1, timeFrom: "08:30" });
  });

  it("accepts a grid with nothing filled in", () => {
    // A teacher who clears every start has no rows, and `expand()` leaves the
    // times off the lesson (fixtures §3.4).
    expect(parse({}).success).toBe(true);
  });

  it("accepts lesson 0, which is a real lesson number", () => {
    expect(parse({ 0: "07:40", 1: "08:30" }).success).toBe(true);
  });

  it("accepts a start typed without the leading zero and returns it as HH:MM", () => {
    const parsed = parse({ 1: "8:30" });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.bells[1].timeFrom).toBe("08:30");
  });

  it("accepts a start typed on a keyboard with no colon", () => {
    const parsed = parse({ 1: "830", 2: "0925", 3: "10.25" });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.bells.slice(1, 4).map((bell) => bell.timeFrom)).toStrictEqual([
      "08:30",
      "09:25",
      "10:25",
    ]);
  });

  it("rejects a start that is not a time", () => {
    expect(errorsFor({ 1: "вранці" })).toStrictEqual({ [bellField(1)]: NOT_A_TIME });
    expect(errorsFor({ 1: "24:00" })).toStrictEqual({ [bellField(1)]: NOT_A_TIME });
    expect(errorsFor({ 1: "08:60" })).toStrictEqual({ [bellField(1)]: NOT_A_TIME });
    expect(errorsFor({ 1: "8" })).toStrictEqual({ [bellField(1)]: NOT_A_TIME });
  });

  it("rejects AM/PM — every time on the section is 24-hour", () => {
    expect(errorsFor({ 6: "1:30 PM" })).toStrictEqual({ [bellField(6)]: NOT_A_TIME });
  });

  it("rejects seconds, which the column does not carry", () => {
    // `time_from`/`time_to` are read back as HH:MM (`getBellSchedule()`), and
    // the form must submit what the domain reads.
    expect(errorsFor({ 1: "08:30:00" })).toStrictEqual({ [bellField(1)]: NOT_A_TIME });
  });

  it("takes a lesson length from 10 to 90 minutes", () => {
    expect(parse({ 1: "08:30" }, "10").data?.lessonMinutes).toBe(10);
    expect(parse({ 1: "08:30" }, "90").data?.lessonMinutes).toBe(90);
    expect(parse({ 1: "08:30" }, " 40 ").data?.lessonMinutes).toBe(40);
  });

  it("rejects a lesson length outside 10–90, on the length's own field", () => {
    for (const lessonMinutes of ["9", "91", "0", "600"]) {
      expect(errorsFor({ 1: "08:30" }, lessonMinutes), lessonMinutes).toStrictEqual({
        [BELL_SCHEDULE_FIELD.lessonMinutes]: LESSON_MINUTES_RULE,
      });
    }
  });

  it("rejects a lesson length that is not a whole number", () => {
    for (const lessonMinutes of ["", "45.5", "45,5", "-45", "сорок п’ять", "4e1"]) {
      expect(errorsFor({ 1: "08:30" }, lessonMinutes), lessonMinutes).toStrictEqual({
        [BELL_SCHEDULE_FIELD.lessonMinutes]: LESSON_MINUTES_RULE,
      });
    }
  });

  it("requires a lesson length even when no start is filled in", () => {
    expect(errorsFor({}, "")).toStrictEqual({
      [BELL_SCHEDULE_FIELD.lessonMinutes]: LESSON_MINUTES_RULE,
    });
  });

  it("accepts a lesson that ends at 23:59 and rejects one that ends after it", () => {
    // 23:14 + 45 = 23:59; 23:15 + 45 = 24:00.
    expect(parse({ 9: "23:14" }).success).toBe(true);
    expect(errorsFor({ 9: "23:15" })).toStrictEqual({ [bellField(9)]: PAST_MIDNIGHT });
  });

  it("rejects a start that is not later than the lesson above it", () => {
    expect(errorsFor({ 1: "09:25", 2: "08:30" })).toStrictEqual({
      [bellField(2)]: STARTS_GROW,
    });
    expect(errorsFor({ 1: "08:30", 2: "08:30" })).toStrictEqual({
      [bellField(2)]: STARTS_GROW,
    });
  });

  it("compares a start with the previous filled lesson, across empty rows", () => {
    expect(errorsFor({ 1: "10:00", 4: "09:00" })).toStrictEqual({
      [bellField(4)]: STARTS_GROW,
    });
  });

  it("rejects a lesson that starts before the previous one has ended", () => {
    // 08:30 + 45 = 09:15, and lesson 2 starts at 09:10.
    expect(errorsFor({ 1: "08:30", 2: "09:10" })).toStrictEqual({
      [bellField(2)]: "Попередній урок закінчується о 09:15 — цей не може початися раніше",
    });
  });

  it("lets a lesson start the minute the previous one ends", () => {
    expect(parse({ 1: "08:30", 2: "09:15" }).success).toBe(true);
  });

  it("judges the overlap by the length submitted, not by 45", () => {
    // 08:30 + 40 = 09:10, so 09:10 is free; with 45 it is not.
    expect(parse({ 1: "08:30", 2: "09:10" }, "40").success).toBe(true);
    // 08:30 + 60 = 09:30, which runs into the fixture's lesson 2 at 09:25.
    // Lesson 3 starts at 10:25, the minute lesson 2 would end, and is free.
    expect(errorsFor(FIXTURE_STARTS, "60")).toStrictEqual({
      [bellField(2)]: "Попередній урок закінчується о 09:30 — цей не може початися раніше",
      [bellField(4)]: "Попередній урок закінчується о 11:25 — цей не може початися раніше",
      [bellField(5)]: "Попередній урок закінчується о 12:20 — цей не може початися раніше",
    });
  });

  it("does not compare a start against a row that is not a time", () => {
    expect(errorsFor({ 1: "bad", 2: "08:00" })).toStrictEqual({
      [bellField(1)]: NOT_A_TIME,
    });
  });

  it("reports only the length while the length is wrong, plus starts that are not times", () => {
    // No end can be computed, so no rule about ends is reported.
    expect(errorsFor({ 1: "09:25", 2: "08:30", 3: "bad" }, "5")).toStrictEqual({
      [BELL_SCHEDULE_FIELD.lessonMinutes]: LESSON_MINUTES_RULE,
      [bellField(3)]: NOT_A_TIME,
    });
  });

  it("reports every broken row, not just the first", () => {
    expect(errorsFor({ 1: "08:30", 2: "08:00", 4: "bad", 9: "23:30" })).toStrictEqual({
      [bellField(2)]: STARTS_GROW,
      [bellField(4)]: NOT_A_TIME,
      [bellField(9)]: PAST_MIDNIGHT,
    });
  });

  it("refuses a grid that is not all ten lesson numbers", () => {
    // `bellFieldErrors()` reads the lesson number off the array index, which is
    // only sound while every submission carries all ten rows in order.
    const parsed = bellScheduleInput.safeParse({
      lessonMinutes: "45",
      bells: grid().slice(0, 5),
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe("Розклад дзвінків має містити уроки 0–9");
  });
});

describe("bellField()", () => {
  it("names each lesson's start distinctly", () => {
    expect(bellField(0)).toBe("bell-0-from");
    expect(bellField(9)).toBe("bell-9-from");
  });
});

describe("parseLessonMinutes()", () => {
  it("reads a whole number within the range and nothing else", () => {
    expect(parseLessonMinutes("45")).toBe(45);
    expect(parseLessonMinutes(" 10 ")).toBe(10);
    expect(parseLessonMinutes("9")).toBeUndefined();
    expect(parseLessonMinutes("91")).toBeUndefined();
    expect(parseLessonMinutes("")).toBeUndefined();
    expect(parseLessonMinutes("45.0")).toBeUndefined();
  });
});

describe("clockTimeInput()", () => {
  it("spells a typed time as HH:MM", () => {
    expect(clockTimeInput("8:30")).toBe("08:30");
    expect(clockTimeInput(" 08:30 ")).toBe("08:30");
    expect(clockTimeInput("830")).toBe("08:30");
    expect(clockTimeInput("0830")).toBe("08:30");
    expect(clockTimeInput("1510")).toBe("15:10");
    expect(clockTimeInput("8.30")).toBe("08:30");
    expect(clockTimeInput("13:30")).toBe("13:30");
  });

  it("leaves what is not a time for the field to refuse", () => {
    expect(clockTimeInput("")).toBe("");
    expect(clockTimeInput("8")).toBe("8");
    expect(clockTimeInput("83")).toBe("83");
    expect(clockTimeInput("08:30:00")).toBe("08:30:00");
    expect(clockTimeInput("1:30 PM")).toBe("1:30 PM");
  });
});
