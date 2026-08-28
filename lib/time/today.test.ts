import { describe, expect, it } from "vitest";
import { today } from "./today";

describe("today()", () => {
  it("returns the Kyiv date, not the UTC one, just after Kyiv midnight", () => {
    // 2026-10-25T22:30:00Z is 2026-10-26 00:30 in Kyiv (UTC+2 after the
    // October DST change), so the Kyiv date is already the next day.
    expect(today(new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-26");
  });

  it("agrees with the UTC date during the day", () => {
    // 2026-06-01T00:30:00Z is 2026-06-01 03:30 in Kyiv (UTC+3, summer time).
    expect(today(new Date("2026-06-01T00:30:00Z"))).toBe("2026-06-01");
  });

  it("formats as YYYY-MM-DD", () => {
    expect(today(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });
});
