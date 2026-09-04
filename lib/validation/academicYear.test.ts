import { describe, expect, it } from "vitest";
import { academicYearInput } from "./academicYear";

/**
 * Specification §3.1 and §4 as the form's boundary.
 *
 * The cases are the ones the database cannot catch in time to be useful — a
 * reversed range and a missing initial parity — plus the two the schema must
 * *not* reject: a one-day year is legal by `academic_year_dates_ck`
 * (`date_from <= date_to`), and a year that starts on any weekday is legal
 * because an anchor need not fall on a Monday (schema §4.6).
 */

const valid = {
  dateFrom: "2026-09-01",
  dateTo: "2027-05-31",
  initialParity: "NUMERATOR",
};

const errorsOf = (input: unknown) => {
  const parsed = academicYearInput.safeParse(input);
  return parsed.success ? [] : parsed.error.issues;
};

describe("academicYearInput", () => {
  it("accepts the fixture year", () => {
    // Fixtures §3.1 — Y1, whose initial parity is NUMERATOR (§3.5, A1).
    expect(academicYearInput.parse(valid)).toStrictEqual(valid);
  });

  it("rejects a year that ends before it starts", () => {
    const issues = errorsOf({ ...valid, dateTo: "2026-08-31" });

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toStrictEqual(["dateTo"]);
    expect(issues[0].message).toBe(
      "Дата завершення не може бути раніша за дату початку",
    );
  });

  it("accepts a year one day long", () => {
    // `date_from <= date_to`, not `<` — both ends are inclusive (schema §6).
    expect(
      academicYearInput.safeParse({ ...valid, dateTo: valid.dateFrom }).success,
    ).toBe(true);
  });

  it("names the field that was left empty", () => {
    const issues = errorsOf({ ...valid, dateFrom: "" });

    expect(issues[0].path).toStrictEqual(["dateFrom"]);
    expect(issues[0].message).toBe("Виберіть дату початку навчального року");
  });

  it("rejects a date that does not exist", () => {
    // 2027 is not a leap year; `<input type="date">` cannot produce this, a
    // hand-made request can.
    expect(errorsOf({ ...valid, dateTo: "2027-02-29" })[0].path).toStrictEqual([
      "dateTo",
    ]);
  });

  it("rejects a date in any other format", () => {
    expect(errorsOf({ ...valid, dateFrom: "01.09.2026" })[0].message).toBe(
      "Дата має бути у форматі РРРР-ММ-ДД",
    );
  });

  it("requires the initial parity, which is not a column but a row", () => {
    // Schema §4.1, finding F-1: the year's initial value is the `ParityAnchor`
    // on `date_from`, so the form must carry it.
    const issues = errorsOf({ dateFrom: valid.dateFrom, dateTo: valid.dateTo });

    expect(issues[0].path).toStrictEqual(["initialParity"]);
    expect(issues[0].message).toBe("Оберіть, з чого починається рік");
  });

  it("rejects a parity value the database does not have", () => {
    expect(errorsOf({ ...valid, initialParity: "NUMERATOR_2" })).toHaveLength(1);
  });
});
