import { describe, expect, it } from "vitest";
import type { AcademicYearRow } from "@/lib/db/queries/yearSetup";
import { pickYear } from "./selection";

/**
 * Which year the screen opens on — the four cases of `pickYear()`.
 *
 * The years are the fixture's Y1 (`expand-fixtures.md` §3.1) and the one after
 * it, in the order `listAcademicYears()` returns them.
 */

const Y1: AcademicYearRow = {
  id: "y1",
  dateFrom: "2026-09-01",
  dateTo: "2027-05-31",
};
const Y2: AcademicYearRow = {
  id: "y2",
  dateFrom: "2027-09-01",
  dateTo: "2028-05-31",
};
const years = [Y1, Y2];

describe("pickYear()", () => {
  it("has nothing to pick before the first year is created", () => {
    expect(pickYear([], undefined, "2026-11-10")).toBeNull();
    expect(pickYear([], "y1", "2026-11-10")).toBeNull();
  });

  it("picks the requested year", () => {
    expect(pickYear(years, "y2", "2026-11-10")).toBe(Y2);
  });

  it("ignores a requested year that is not the teacher's", () => {
    // The id came from a URL. Falling back is the whole point: the alternative
    // is trusting it, and `listAcademicYears()` only returns this teacher's.
    expect(pickYear(years, "someone-elses", "2026-11-10")).toBe(Y1);
  });

  it("picks the year being taught", () => {
    expect(pickYear(years, undefined, "2026-11-10")).toBe(Y1);
    expect(pickYear(years, undefined, "2026-09-01")).toBe(Y1);
    expect(pickYear(years, undefined, "2027-05-31")).toBe(Y1);
  });

  it("picks the next year to start when none is running", () => {
    // August: Y1 has ended, Y2 is the one being prepared.
    expect(pickYear(years, undefined, "2027-08-15")).toBe(Y2);
  });

  it("picks the first year before any of them have started", () => {
    expect(pickYear(years, undefined, "2026-08-01")).toBe(Y1);
  });

  it("picks the last year once they are all over", () => {
    expect(pickYear(years, undefined, "2030-01-01")).toBe(Y2);
  });
});
