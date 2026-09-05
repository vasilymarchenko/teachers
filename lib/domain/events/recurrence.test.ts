import { describe, expect, it } from "vitest";
import type { DateRange } from "@/lib/domain/schedule/types";
import { occurrencesInRange, type RecurrenceInput } from "./recurrence";

/**
 * Every expectation here is read off `docs/architecture/design/T-012-events.md`
 * §4 — the worked cases W1, B1, M1, Y1, Y2, N1 and N2 — and none of it was
 * obtained by running the code. The dates belong to the fixture year of
 * `expand-fixtures.md` §3: 2026-09-01 … 2027-05-31, with the autumn break
 * opening on 2026-10-26.
 */

const OCTOBER: DateRange = { from: "2026-10-01", to: "2026-10-31" };
const SCHOOL_YEAR: DateRange = { from: "2026-09-01", to: "2027-05-31" };

/** A repeating INFO event: one day per occurrence, bounded exclusively (§8.1). */
const repeating = (
  dateFrom: string,
  recurrenceKind: RecurrenceInput["recurrenceKind"],
  boundaryDate: string,
): RecurrenceInput => ({
  dateFrom,
  dateTo: null,
  recurrenceKind,
  boundaryDate,
});

/** A one-off event: a day, or a span of them. */
const oneOff = (dateFrom: string, dateTo: string | null = null): RecurrenceInput => ({
  dateFrom,
  dateTo,
  recurrenceKind: "NONE",
  boundaryDate: null,
});

describe("WEEKLY", () => {
  it("keeps the weekday of `dateFrom` (W1)", () => {
    // 2026-09-04 is a Friday, and the boundary is the first day of the autumn
    // break (fixtures §3.3, R1). October's Fridays are what the window holds.
    const event = repeating("2026-09-04", "WEEKLY", "2026-10-26");

    expect(occurrencesInRange(event, OCTOBER)).toEqual([
      "2026-10-02",
      "2026-10-09",
      "2026-10-16",
      "2026-10-23",
    ]);
  });

  it("stops **before** the boundary date (B1)", () => {
    const event = repeating("2026-09-04", "WEEKLY", "2026-09-18");

    // The 18th is an occurrence by the weekly step and still not returned: a
    // boundary is exclusive, so the rule holds while `d < boundaryDate`.
    expect(occurrencesInRange(event, SCHOOL_YEAR)).toEqual([
      "2026-09-04",
      "2026-09-11",
    ]);
  });

  it("gives nothing for a window before the event starts", () => {
    const event = repeating("2026-11-06", "WEEKLY", "2027-06-01");

    expect(occurrencesInRange(event, OCTOBER)).toEqual([]);
  });
});

describe("MONTHLY", () => {
  it("skips a month that has no such day (M1, ADR-009)", () => {
    const event = repeating("2026-10-31", "MONTHLY", "2027-06-01");

    // November, February and April have no 31st, so they carry no occurrence
    // at all — the date is never moved onto a day the teacher did not choose.
    expect(occurrencesInRange(event, SCHOOL_YEAR)).toEqual([
      "2026-10-31",
      "2026-12-31",
      "2027-01-31",
      "2027-03-31",
      "2027-05-31",
    ]);
  });

  it("returns the occurrence of every month for a day every month has", () => {
    const event = repeating("2026-09-13", "MONTHLY", "2027-01-01");

    expect(occurrencesInRange(event, SCHOOL_YEAR)).toEqual([
      "2026-09-13",
      "2026-10-13",
      "2026-11-13",
      "2026-12-13",
    ]);
  });
});

describe("YEARLY", () => {
  it("skips a common year for a 29 February event (Y1, ADR-009)", () => {
    const event = repeating("2024-02-29", "YEARLY", "2029-01-01");

    expect(
      occurrencesInRange(event, { from: "2024-01-01", to: "2028-12-31" }),
    ).toEqual(["2024-02-29", "2028-02-29"]);
  });

  it("puts «13 вересня — День золотої рибки» on its one date in the year (Y2)", () => {
    const event = repeating("2026-09-13", "YEARLY", "2030-01-01");

    expect(occurrencesInRange(event, SCHOOL_YEAR)).toEqual(["2026-09-13"]);
  });
});

describe("one-off events", () => {
  it("occupies every day of its span, clipped to the window (N1)", () => {
    // The autumn break week, seen from a window that ends inside it.
    const event = oneOff("2026-10-26", "2026-11-01");

    expect(occurrencesInRange(event, OCTOBER)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
  });

  it("is one date when `dateTo` is absent", () => {
    expect(occurrencesInRange(oneOff("2026-10-14"), OCTOBER)).toEqual([
      "2026-10-14",
    ]);
  });

  it("gives nothing outside the window (N2)", () => {
    expect(occurrencesInRange(oneOff("2026-11-14"), OCTOBER)).toEqual([]);
  });
});

describe("a shape the table cannot hold", () => {
  it("expands a recurrence with no boundary into nothing", () => {
    // `event_recurrence_ck` forbids the row; if one is made by hand anyway, an
    // event that never occurs is a visible bug and an endless one is not.
    const event: RecurrenceInput = {
      dateFrom: "2026-09-04",
      dateTo: null,
      recurrenceKind: "WEEKLY",
      boundaryDate: null,
    };

    expect(occurrencesInRange(event, OCTOBER)).toEqual([]);
  });
});
