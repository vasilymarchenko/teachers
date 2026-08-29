import { describe, expect, it } from "vitest";
import { resolveBoundary } from "./boundaries";
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
