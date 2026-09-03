import { describe, expect, it } from "vitest";
import { nonTeachingPeriodInput } from "./nonTeachingPeriod";

/**
 * Specification §3.1 as the form's boundary — one schema for breaks, public
 * holidays and unplanned days off, because they are one table (overview §4).
 */

const valid = {
  kind: "BREAK",
  name: "Осінні канікули",
  dateFrom: "2026-10-26",
  dateTo: "2026-11-01",
};

const issuesOf = (input: unknown) => {
  const parsed = nonTeachingPeriodInput.safeParse(input);
  return parsed.success ? [] : parsed.error.issues;
};

describe("nonTeachingPeriodInput", () => {
  it("accepts the fixture break", () => {
    // Fixtures §3.2 — P2, the full break week.
    expect(nonTeachingPeriodInput.parse(valid)).toStrictEqual(valid);
  });

  it("accepts a one-day public holiday", () => {
    // Fixtures §3.2 — P1. A holiday is a period whose two dates are equal
    // (schema §4.3), not a shape of its own.
    const holiday = {
      kind: "PUBLIC_HOLIDAY",
      name: "День захисників і захисниць України",
      dateFrom: "2026-10-14",
      dateTo: "2026-10-14",
    };

    expect(nonTeachingPeriodInput.parse(holiday)).toStrictEqual(holiday);
  });

  it("accepts an unplanned day off", () => {
    expect(
      nonTeachingPeriodInput.safeParse({ ...valid, kind: "OTHER", name: "Актований мороз" }).success,
    ).toBe(true);
  });

  it("rejects a kind the database does not have", () => {
    expect(issuesOf({ ...valid, kind: "HOLIDAY" })[0].message).toBe(
      "Оберіть вид неробочого періоду",
    );
  });

  it("requires a name, because the calendar shades the day with it", () => {
    // T-007 names the shading period on the day it covers (overview §5).
    expect(issuesOf({ ...valid, name: "   " })[0]).toMatchObject({
      path: ["name"],
      message: "Введіть назву",
    });
  });

  it("trims the name it stores", () => {
    expect(nonTeachingPeriodInput.parse({ ...valid, name: "  Зимові канікули " }).name).toBe(
      "Зимові канікули",
    );
  });

  it("rejects a period that ends before it starts", () => {
    expect(issuesOf({ ...valid, dateTo: "2026-10-25" })[0]).toMatchObject({
      path: ["dateTo"],
    });
  });
});
