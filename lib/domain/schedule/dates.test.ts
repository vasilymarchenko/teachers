import { describe, expect, it } from "vitest";
import { isIsoDate } from "./dates";

/**
 * The arithmetic in this module is exercised by `expand.test.ts`,
 * `parity.test.ts` and `lib/domain/calendar/views.test.ts` — through the
 * functions that use it. `isIsoDate()` is the one thing nothing else pins: it
 * guards a URL segment, so what it *rejects* is the whole point.
 */
describe("isIsoDate", () => {
  it("accepts a real date", () => {
    expect(isIsoDate("2026-10-19")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects a date that does not exist", () => {
    // `parseISO` would normalise this to 2 March, and the calendar would then
    // render a day the teacher did not ask for.
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2029-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
  });

  it("rejects anything that is not the plain format", () => {
    expect(isIsoDate("2026-10-19T00:00:00Z")).toBe(false);
    expect(isIsoDate("19.10.2026")).toBe(false);
    expect(isIsoDate("сьогодні")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});
