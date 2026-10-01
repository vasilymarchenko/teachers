import { describe, expect, it } from "vitest";
import {
  DEFAULT_LESSON_MINUTES,
  lessonEnd,
  storedLessonMinutes,
} from "./bells";
import { FIXTURE } from "./fixtures/scenario";

/**
 * Specification §3.3 — the end of a lesson is its start plus the lesson
 * length. The expected times are the fixture's own bell rows (fixtures §3.4),
 * which are 45 minutes long, and sums done by hand.
 */

describe("lessonEnd()", () => {
  it("reproduces every bell of the fixture from its start and 45 minutes", () => {
    for (const bell of FIXTURE.bells) {
      expect(lessonEnd(bell.timeFrom, 45), `lesson ${bell.lessonNumber}`).toBe(
        bell.timeTo,
      );
    }
  });

  it("carries minutes into the hour", () => {
    expect(lessonEnd("07:40", 45)).toBe("08:25");
    expect(lessonEnd("13:30", 40)).toBe("14:10");
    expect(lessonEnd("15:10", 90)).toBe("16:40");
  });

  it("keeps the zero padding the domain compares times by", () => {
    expect(lessonEnd("08:00", 10)).toBe("08:10");
    expect(lessonEnd("08:55", 10)).toBe("09:05");
  });

  it("allows a lesson that ends at 23:59", () => {
    expect(lessonEnd("23:14", 45)).toBe("23:59");
  });

  it("has no end for a lesson that would pass midnight", () => {
    // A bell row has no date: 00:00 would be an end before its start.
    expect(lessonEnd("23:15", 45)).toBeUndefined();
    expect(lessonEnd("23:30", 45)).toBeUndefined();
  });

  it("has no end for a start that is not HH:MM", () => {
    expect(lessonEnd("8:30", 45)).toBeUndefined();
    expect(lessonEnd("24:00", 45)).toBeUndefined();
    expect(lessonEnd("08:60", 45)).toBeUndefined();
    expect(lessonEnd("08:30:00", 45)).toBeUndefined();
    expect(lessonEnd("", 45)).toBeUndefined();
  });

  it("has no end for a length that is not a positive whole number", () => {
    expect(lessonEnd("08:30", 0)).toBeUndefined();
    expect(lessonEnd("08:30", -45)).toBeUndefined();
    expect(lessonEnd("08:30", 44.5)).toBeUndefined();
    expect(lessonEnd("08:30", Number.NaN)).toBeUndefined();
  });
});

describe("storedLessonMinutes()", () => {
  it("is the default of 45 when there are no rows", () => {
    expect(DEFAULT_LESSON_MINUTES).toBe(45);
    expect(storedLessonMinutes([])).toStrictEqual({
      lessonMinutes: 45,
      mixed: false,
    });
  });

  it("reads 45 off the fixture's bells, which share one length", () => {
    expect(storedLessonMinutes(FIXTURE.bells)).toStrictEqual({
      lessonMinutes: 45,
      mixed: false,
    });
  });

  it("reads a length other than the default", () => {
    expect(
      storedLessonMinutes([
        { lessonNumber: 1, timeFrom: "08:30", timeTo: "09:10" },
        { lessonNumber: 2, timeFrom: "09:20", timeTo: "10:00" },
      ]),
    ).toStrictEqual({ lessonMinutes: 40, mixed: false });
  });

  it("takes the lowest-numbered row's length when the rows differ", () => {
    expect(
      storedLessonMinutes([
        { lessonNumber: 1, timeFrom: "08:30", timeTo: "09:10" },
        { lessonNumber: 2, timeFrom: "09:25", timeTo: "10:10" },
      ]),
    ).toStrictEqual({ lessonMinutes: 40, mixed: true });
  });

  it("goes by lesson number, not by the order the rows arrive in", () => {
    expect(
      storedLessonMinutes([
        { lessonNumber: 2, timeFrom: "09:25", timeTo: "10:10" },
        { lessonNumber: 0, timeFrom: "07:40", timeTo: "08:10" },
      ]),
    ).toStrictEqual({ lessonMinutes: 30, mixed: true });
  });
});
