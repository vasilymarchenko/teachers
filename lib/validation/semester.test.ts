import { describe, expect, it } from "vitest";
import { semesterInput } from "./semester";

/**
 * Specification §3.2 as the form's boundary — two semesters, no quarters.
 *
 * `index` arrives as a string from the form, so the coercion is part of what is
 * being tested: a select that submitted `"1"` must produce the `smallint` 1 the
 * `semester_index_ck` constraint expects.
 */

const valid = { index: "1", dateFrom: "2026-09-01", dateTo: "2026-12-24" };

const messagesOf = (input: unknown) => {
  const parsed = semesterInput.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
};

describe("semesterInput", () => {
  it("coerces the submitted index to a number", () => {
    // Fixtures §3.1 — S1.
    expect(semesterInput.parse(valid)).toStrictEqual({
      index: 1,
      dateFrom: "2026-09-01",
      dateTo: "2026-12-24",
    });
  });

  it("accepts the second semester", () => {
    expect(
      semesterInput.parse({ ...valid, index: "2", dateFrom: "2027-01-12", dateTo: "2027-05-31" }).index,
    ).toBe(2);
  });

  it("rejects a third semester", () => {
    // «Поняття чвертей у програмі немає» (§3.2); `semester_index_ck` allows 1, 2.
    expect(messagesOf({ ...valid, index: "3" })).toStrictEqual([
      "Семестр може бути тільки перший або другий",
    ]);
  });

  it("rejects a fractional index", () => {
    expect(messagesOf({ ...valid, index: "1.5" })).toStrictEqual([
      "Оберіть номер семестру",
    ]);
  });

  it("rejects an empty index rather than reading it as zero", () => {
    // `z.coerce.number()` turns "" into 0, which is not a semester.
    expect(messagesOf({ ...valid, index: "" })).toStrictEqual([
      "Семестр може бути тільки перший або другий",
    ]);
  });

  it("rejects a semester that ends before it starts", () => {
    expect(messagesOf({ ...valid, dateTo: "2026-08-31" })).toStrictEqual([
      "Дата завершення не може бути раніша за дату початку",
    ]);
  });
});
