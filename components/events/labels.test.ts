import { describe, expect, it } from "vitest";
import { eventSchedule } from "./labels";

/**
 * The one line an event says about when it happens. Every expected string is
 * written out here as the teacher reads it, so a reworded label or a changed
 * date format fails the suite instead of quietly changing the screen.
 */

const oneOff = (dateFrom: string, dateTo: string | null = null) => ({
  dateFrom,
  dateTo,
  recurrenceKind: "NONE" as const,
  boundaryDate: null,
  boundaryKind: null,
});

describe("a one-off event", () => {
  it("shows its date", () => {
    expect(eventSchedule(oneOff("2026-10-15"))).toBe("15 жовтня 2026 р.");
  });

  it("shows both ends of a span", () => {
    expect(eventSchedule(oneOff("2026-10-26", "2026-11-01"))).toBe(
      "26 жовтня — 1 листопада 2026 р.",
    );
  });

  it("shows one date when the span is a single day", () => {
    expect(eventSchedule(oneOff("2026-10-15", "2026-10-15"))).toBe(
      "15 жовтня 2026 р.",
    );
  });
});

describe("a repeating event", () => {
  it("names the symbol the teacher chose and the date it was resolved to", () => {
    // The boundary is exclusive (overview §8.1), so a repetition bounded by
    // 2026-10-26 still happens on the 25th — and the teacher is shown that day,
    // never the stored one.
    expect(
      eventSchedule({
        dateFrom: "2026-09-04",
        dateTo: null,
        recurrenceKind: "WEEKLY",
        boundaryDate: "2026-10-26",
        boundaryKind: "NEXT_BREAK",
      }),
    ).toBe(
      "Щотижня з 4 вересня, до найближчих канікул (востаннє до 25 жовтня 2026 р.)",
    );
  });

  it("names a yearly repetition the same way", () => {
    expect(
      eventSchedule({
        dateFrom: "2026-09-13",
        dateTo: null,
        recurrenceKind: "YEARLY",
        boundaryDate: "2030-01-01",
        boundaryKind: "DATE",
      }),
    ).toBe("Щороку з 13 вересня, до вибраної дати (востаннє до 31 грудня 2029 р.)");
  });
});
