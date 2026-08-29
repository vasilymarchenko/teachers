import { describe, expect, it } from "vitest";
import { isNonTeachingOn, weekdayOf } from "./calendarRules";
import { EXPECTED_OWN } from "./fixtures/expected";
import { FIXTURE } from "./fixtures/scenario";

/**
 * The `isNonTeaching` column of `docs/architecture/design/expand-fixtures.md`
 * §6, which §7 states is identical for the `CLASS` view — the rules are
 * view-independent.
 */
describe("isNonTeachingOn()", () => {
  const rules = {
    periods: FIXTURE.nonTeachingPeriods,
    weekdayRules: FIXTURE.weekdayRules,
  };

  it.each(EXPECTED_OWN.map((day) => [day.date, day.isNonTeaching] as const))(
    "%s is non-teaching: %s",
    (date, expected) => {
      expect(isNonTeachingOn(date, rules)).toBe(expected);
    },
  );

  // Fixtures §3.3 and finding F-4: `boundaryDate` is exclusive, so R1 covers the
  // Fridays before the break and stops on the day the break starts.
  it("ends a weekday rule on its exclusive boundaryDate", () => {
    expect(isNonTeachingOn("2026-10-16", rules)).toBe(true);
    expect(isNonTeachingOn("2026-10-23", rules)).toBe(true);
    expect(isNonTeachingOn("2026-11-06", rules)).toBe(false);
  });

  // Fixtures §6, 2026-10-30: P2 and R1 would both have matched; overlapping
  // reasons are not an error, and R1 has already expired anyway.
  it("is an OR over the two sources", () => {
    expect(isNonTeachingOn("2026-10-31", rules)).toBe(true);
    expect(isNonTeachingOn("2026-10-14", rules)).toBe(true);
  });

  // Fixtures §3.2: a period's dates are both inclusive.
  it("treats a NonTeachingPeriod as inclusive at both ends", () => {
    expect(isNonTeachingOn("2026-10-26", rules)).toBe(true);
    expect(isNonTeachingOn("2026-11-01", rules)).toBe(true);
    expect(isNonTeachingOn("2026-11-02", rules)).toBe(false);
  });
});

describe("weekdayOf()", () => {
  // The ISO numbering the `weekday` enum stands for: 1 = Monday … 7 = Sunday.
  it.each([
    ["2026-10-12", "MON"],
    ["2026-10-13", "TUE"],
    ["2026-10-14", "WED"],
    ["2026-10-15", "THU"],
    ["2026-10-16", "FRI"],
    ["2026-10-17", "SAT"],
    ["2026-10-18", "SUN"],
  ])("%s is %s", (date, weekday) => {
    expect(weekdayOf(date)).toBe(weekday);
  });
});
