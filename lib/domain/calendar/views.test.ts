import { describe, expect, it } from "vitest";
import { isCalendarViewName, isInMonthOf, rangeFor, stepBy } from "./views";

/**
 * The ranges of overview §5, and the Monday-start rule of §8.5.
 *
 * Dates are taken from the fixture window of
 * `docs/architecture/design/expand-fixtures.md` §1 wherever one fits, so a
 * failure here and a failure in `expand.test.ts` talk about the same week.
 */

describe("rangeFor", () => {
  it("gives the date itself for the day view", () => {
    expect(rangeFor("day", "2026-10-19")).toEqual({
      from: "2026-10-19",
      to: "2026-10-19",
    });
  });

  it("gives Monday to Sunday for the week view", () => {
    // 2026-W43 of the fixture: Mon 10-19 … Sun 10-25.
    expect(rangeFor("week", "2026-10-21")).toEqual({
      from: "2026-10-19",
      to: "2026-10-25",
    });
  });

  it("starts the week on Monday even when the date is that Sunday", () => {
    // The Sunday belongs to the week that began six days earlier, not to the
    // one starting the next day: a US-style week would answer 10-25 … 10-31.
    expect(rangeFor("week", "2026-10-25")).toEqual({
      from: "2026-10-19",
      to: "2026-10-25",
    });
  });

  it("pads the month view to whole ISO weeks", () => {
    // October 2026 runs Thu 10-01 … Sat 10-31, so the grid spans
    // Mon 09-28 … Sun 11-01.
    expect(rangeFor("month", "2026-10-19")).toEqual({
      from: "2026-09-28",
      to: "2026-11-01",
    });
  });

  it("pads a month that already begins on a Monday", () => {
    // June 2026 begins on Mon 06-01 and ends on Tue 06-30: the front needs no
    // padding, the back needs five days.
    expect(rangeFor("month", "2026-06-15")).toEqual({
      from: "2026-06-01",
      to: "2026-07-05",
    });
  });

  it("uses the academic year for the year view when there is one", () => {
    // Fixtures §3.1 — AcademicYear Y1.
    const year = { from: "2026-09-01", to: "2027-05-31" };
    expect(rangeFor("year", "2026-10-19", year)).toEqual(year);
  });

  it("falls back to the calendar year when the date is in no academic year", () => {
    // August, before year setup has run: `getYearFrame()` answers `null`, and
    // the screen still has to render.
    expect(rangeFor("year", "2026-08-14")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });
});

describe("stepBy", () => {
  it("moves one day, keeping the month boundary honest", () => {
    expect(stepBy("day", "2026-10-31", 1)).toBe("2026-11-01");
    expect(stepBy("day", "2026-11-01", -1)).toBe("2026-10-31");
  });

  it("moves a whole week, landing on the same weekday", () => {
    expect(stepBy("week", "2026-10-19", 1)).toBe("2026-10-26");
    expect(stepBy("week", "2026-10-19", -1)).toBe("2026-10-12");
  });

  it("clamps a month step to the length of the month it lands in", () => {
    // 31 March back one month is 28 February 2026, not 3 March.
    expect(stepBy("month", "2026-03-31", -1)).toBe("2026-02-28");
    expect(stepBy("month", "2026-12-15", 1)).toBe("2027-01-15");
  });

  it("clamps a year step on 29 February", () => {
    expect(stepBy("year", "2028-02-29", 1)).toBe("2029-02-28");
  });
});

describe("isCalendarViewName", () => {
  it("accepts the four views and nothing else", () => {
    for (const view of ["day", "week", "month", "year"]) {
      expect(isCalendarViewName(view)).toBe(true);
    }
    expect(isCalendarViewName("semester")).toBe(false);
    expect(isCalendarViewName("Day")).toBe(false);
  });
});

describe("isInMonthOf", () => {
  it("separates the month's own days from the padding around them", () => {
    expect(isInMonthOf("2026-10-01", "2026-10-19")).toBe(true);
    expect(isInMonthOf("2026-09-28", "2026-10-19")).toBe(false);
    expect(isInMonthOf("2026-11-01", "2026-10-19")).toBe(false);
  });
});
