import { describe, expect, it } from "vitest";
import type { CalendarDay } from "@/lib/domain/calendar/days";
import { dayTooltip } from "./labels";

/**
 * The year view's cell shows a number and nothing else, so its tooltip is the
 * whole of what that day can say. The case worth pinning is the one the grid
 * would otherwise lose: a teaching day whose only lesson a `CLEARED` override
 * removed must not read as a free day (specification §5.3, fixtures §5, 10-19).
 */

function day(fields: Partial<CalendarDay>): CalendarDay {
  return {
    date: "2026-10-19",
    parity: "DENOMINATOR",
    isNonTeaching: false,
    lessons: [],
    cancelled: [],
    ...fields,
  };
}

const lesson = (lessonNumber: number) => ({
  lessonNumber,
  payload: { subject: "Математика", className: "7-А" },
  origin: "TEMPLATE" as const,
});

describe("dayTooltip", () => {
  it("counts the cancelled lessons of an otherwise empty day", () => {
    expect(dayTooltip(day({ cancelled: [lesson(1)] }))).toBe(
      "19 жовтня — уроків немає · скасовано: 1",
    );
  });

  it("counts them alongside the lessons that remain", () => {
    expect(
      dayTooltip(day({ lessons: [lesson(2)], cancelled: [lesson(1)] })),
    ).toBe("19 жовтня — уроків: 1 · скасовано: 1");
  });

  it("says nothing of cancellations when there are none", () => {
    expect(dayTooltip(day({ lessons: [lesson(1)] }))).toBe(
      "19 жовтня — уроків: 1",
    );
  });

  it("names a non-teaching day instead of counting", () => {
    expect(
      dayTooltip(
        day({ isNonTeaching: true, nonTeachingName: "Осінні канікули" }),
      ),
    ).toBe("19 жовтня — Осінні канікули");
  });
});
