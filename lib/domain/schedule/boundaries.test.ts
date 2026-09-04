import { describe, expect, it } from "vitest";
import {
  boundaryWithinYear,
  resolveBoundary,
  ruleValidFrom,
} from "./boundaries";
import { BREAKS, SEMESTERS, YEAR } from "./fixtures/scenario";

/**
 * The resolutions that produced the stored values in
 * `docs/architecture/design/expand-fixtures.md` §3.3 and §3.6, replayed from the
 * write timeline of §3.8.
 */
describe("resolveBoundary()", () => {
  // §3.3, R1 «методичний день … until the autumn break starts» → 2026-10-26,
  // the break's first day, because the boundary is exclusive (finding F-4).
  it("resolves NEXT_BREAK to the first day of the next break", () => {
    expect(
      resolveBoundary({
        kind: "NEXT_BREAK",
        referenceDate: YEAR.dateFrom,
        breaks: BREAKS,
      }),
    ).toBe("2026-10-26");
  });

  it("ignores a break that has already started", () => {
    expect(
      resolveBoundary({
        kind: "NEXT_BREAK",
        referenceDate: "2026-10-27",
        breaks: BREAKS,
      }),
    ).toBeUndefined();
  });

  // §3.6, OWN-V1 entered with «до кінця семестру» → 2026-12-25, the day after
  // S1's inclusive last day 2026-12-24.
  it("resolves END_OF_SEMESTER to the day after the semester's last day", () => {
    expect(
      resolveBoundary({
        kind: "END_OF_SEMESTER",
        referenceDate: YEAR.dateFrom,
        semesters: SEMESTERS,
      }),
    ).toBe("2026-12-25");
  });

  // §3.8: year setup ran on 2026-08-20, before the year had begun, and still
  // produced S1's end rather than nothing.
  it("takes the next semester when the reference date precedes them all", () => {
    expect(
      resolveBoundary({
        kind: "END_OF_SEMESTER",
        referenceDate: "2026-08-20",
        semesters: SEMESTERS,
      }),
    ).toBe("2026-12-25");
  });

  it("moves on to the second semester once the first has ended", () => {
    expect(
      resolveBoundary({
        kind: "END_OF_SEMESTER",
        referenceDate: "2027-01-12",
        semesters: SEMESTERS,
      }),
    ).toBe("2027-06-01");
  });

  // §3.3, R2/R3: the weekend rules run to the end of the year, whose inclusive
  // last day is 2027-05-31, and the stored boundary is 2027-06-01.
  it("resolves DATE to the day after the teacher's chosen last day", () => {
    expect(
      resolveBoundary({
        kind: "DATE",
        referenceDate: YEAR.dateFrom,
        lastDay: YEAR.dateTo,
      }),
    ).toBe("2027-06-01");
  });

  it("has nothing to resolve without the pieces the kind needs", () => {
    expect(
      resolveBoundary({ kind: "DATE", referenceDate: YEAR.dateFrom }),
    ).toBeUndefined();
    expect(
      resolveBoundary({ kind: "NEXT_BREAK", referenceDate: YEAR.dateFrom }),
    ).toBeUndefined();
    expect(
      resolveBoundary({ kind: "END_OF_SEMESTER", referenceDate: YEAR.dateFrom }),
    ).toBeUndefined();
  });

  // A boundary at or before the reference date would make an empty interval,
  // which the `valid_from < boundary_date` checks reject.
  it("rejects a boundary that is not after the reference date", () => {
    expect(
      resolveBoundary({
        kind: "DATE",
        referenceDate: "2026-10-21",
        lastDay: "2026-10-20",
      }),
    ).toBeUndefined();
  });
});

/**
 * ADR-004 — where a rule written during year setup starts.
 *
 * The fixture's R1–R3 are the "set the year up in advance" case and pin the
 * year's first day; the mid-year case is the one the ADR exists for.
 */
describe("ruleValidFrom()", () => {
  it("starts at the year's first day when the year has not begun", () => {
    // Fixtures §3.3 — R1–R3 are dated 2026-09-01, entered before term.
    expect(ruleValidFrom(YEAR.dateFrom, "2026-08-20")).toBe("2026-09-01");
  });

  it("starts at the year's first day on the first day itself", () => {
    expect(ruleValidFrom(YEAR.dateFrom, "2026-09-01")).toBe("2026-09-01");
  });

  it("starts today for a rule added mid-year", () => {
    // Not 2026-09-01: every Friday since September has already been taught, and
    // a rule reaching back over them rewrites history (specification §5.2).
    expect(ruleValidFrom(YEAR.dateFrom, "2027-03-15")).toBe("2027-03-15");
  });
});

/**
 * The other end of the ADR-004 check: `ruleValidFrom()` keeps a rule from
 * reaching back before the year, this keeps it from reaching past the end.
 *
 * The table has no `academic_year_id`, so `listWeekdayRules()` selects by
 * overlap — a rule that outlives its year is listed under the next one too, and
 * deleting either takes it with them.
 */
describe("boundaryWithinYear()", () => {
  it("accepts a boundary well inside the year", () => {
    // Fixtures §3.3, R1 → the autumn break's first day.
    expect(boundaryWithinYear("2026-10-26", YEAR.dateTo)).toBe(true);
  });

  it("accepts a boundary on the day after the year's last day", () => {
    // Exclusive against inclusive: a rule that stops exactly where the year
    // does is still the year's own (schema §4.4 against §4.1).
    expect(boundaryWithinYear("2027-06-01", YEAR.dateTo)).toBe(true);
  });

  it("rejects a boundary two days past the year's last day", () => {
    expect(boundaryWithinYear("2027-06-02", YEAR.dateTo)).toBe(false);
  });

  it("rejects a mistyped last day that lands in the next year", () => {
    // The failure this check exists for: `lastDay` 2027-09-30 entered under
    // 2026/27 puts the rule in two years at once.
    expect(boundaryWithinYear("2027-10-01", YEAR.dateTo)).toBe(false);
  });
});
