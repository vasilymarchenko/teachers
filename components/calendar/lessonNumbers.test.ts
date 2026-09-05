import { describe, expect, it } from "vitest";
import type { CalendarDay } from "@/lib/domain/calendar/days";
import type { BellInput } from "@/lib/domain/schedule/types";
import { addableLessonNumbers } from "./lessonNumbers";

/**
 * Which numbers a day offers «додати урок» at — specification §5.3.
 *
 * The bells are the fixture's (`design/expand-fixtures.md` §3.4): lessons 1 to
 * 5, with 0 and 6–9 unused, which is what §3.3 of the specification allows.
 */

const BELLS: BellInput[] = [
  { lessonNumber: 1, timeFrom: "08:30", timeTo: "09:15" },
  { lessonNumber: 2, timeFrom: "09:25", timeTo: "10:10" },
  { lessonNumber: 3, timeFrom: "10:25", timeTo: "11:10" },
  { lessonNumber: 4, timeFrom: "11:20", timeTo: "12:05" },
  { lessonNumber: 5, timeFrom: "12:15", timeTo: "13:00" },
];

function day(lessons: number[], cancelled: number[] = []): CalendarDay {
  const lesson = (lessonNumber: number) => ({
    lessonNumber,
    payload: { subject: "Математика", className: "7-А" },
    origin: "TEMPLATE" as const,
  });

  return {
    date: "2026-10-19",
    parity: "DENOMINATOR",
    isNonTeaching: false,
    lessons: lessons.map(lesson),
    cancelled: cancelled.map(lesson),
    events: [],
  };
}

describe("the lesson numbers a day can add an override at", () => {
  it("offers every bell number of an empty day, in order", () => {
    expect(addableLessonNumbers(day([]), BELLS)).toEqual([1, 2, 3, 4, 5]);
  });

  it("does not offer a number the day already shows", () => {
    // That lesson is edited from its own row: two controls for one slot is one
    // too many.
    expect(addableLessonNumbers(day([2, 4]), BELLS)).toEqual([1, 3, 5]);
  });

  it("counts a cancelled lesson as shown (§5.3)", () => {
    // A `CLEARED` override is still a row on the date, struck through — and it
    // is that row the teacher undoes the cancellation from.
    expect(addableLessonNumbers(day([], [1]), BELLS)).toEqual([2, 3, 4, 5]);
  });

  it("offers nothing without a bell schedule", () => {
    // The screen says so and points at the year setup instead: the numbers a
    // school day has are the teacher's to state, not this function's to invent.
    expect(addableLessonNumbers(day([]), [])).toEqual([]);
  });

  it("never offers a number the bells do not have", () => {
    // A lesson at a number with no bell row is still shown by the calendar
    // (`expand()` leaves its times off), but it is not a slot the day invites
    // the teacher to fill.
    expect(addableLessonNumbers(day([7]), BELLS)).toEqual([1, 2, 3, 4, 5]);
  });
});
