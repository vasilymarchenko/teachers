import { describe, expect, it } from "vitest";
import { calendarHref, lessonHref, scheduleViewOf } from "./links";

/**
 * The calendar's URLs — T-007 §2, and the override editor T-011 hangs under
 * them.
 *
 * `OWN` is the default and stays out of the address; `CLASS` is spelled, on
 * every link, because a link that dropped it would move the teacher to the
 * other schedule (specification §6.2) — and on the editor it would edit the
 * other schedule's slot.
 */

describe("the calendar's links", () => {
  it("addresses a view by its anchor date, and names CLASS only", () => {
    expect(calendarHref("week", "2026-10-19", "OWN")).toBe(
      "/calendar/week/2026-10-19",
    );
    expect(calendarHref("week", "2026-10-19", "CLASS")).toBe(
      "/calendar/week/2026-10-19?schedule=class",
    );
  });

  it("addresses one lesson under the view it is edited from", () => {
    expect(lessonHref("day", "2026-10-19", 1, "OWN")).toBe(
      "/calendar/day/2026-10-19/lesson/1",
    );
    expect(lessonHref("week", "2026-11-05", 2, "CLASS")).toBe(
      "/calendar/week/2026-11-05/lesson/2?schedule=class",
    );
  });

  it("round-trips the schedule switch through the search parameter", () => {
    const href = lessonHref("day", "2026-10-19", 0, "CLASS");
    const value = new URL(href, "https://example.test").searchParams.get(
      "schedule",
    );

    expect(scheduleViewOf(value ?? undefined)).toBe("CLASS");
    expect(scheduleViewOf(undefined)).toBe("OWN");
  });
});
