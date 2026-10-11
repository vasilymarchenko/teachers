import { describe, expect, it } from "vitest";
import { templateBothWeeksField } from "@/lib/validation/templateDay";
import type { SlotPayload } from "@/lib/validation/slotPayload";
import { rowIsBlank, rowLine, shownLine, untrackedToggles } from "./bothWeeks";

/**
 * The row's line and the toggles T-047 leaves out — T-043, ADR-025. The suite
 * has no DOM, so `shownLine()` stands for the CSS that picks a candidate. The
 * sentences are the ticket's own, written out rather than rebuilt from the
 * labels, so a reworded label fails here.
 */

const physics: SlotPayload = { subject: "Фізика", className: "7-А" };
const chemistry: SlotPayload = { subject: "Хімія", className: "8-Б" };

const show = (
  own: SlotPayload | undefined,
  other: SlotPayload | undefined,
  state: { checked: boolean; empty: boolean },
) => shownLine(rowLine("OWN", "NUMERATOR", own, other), state);

describe("the row's line with the toggle off", () => {
  const off = { checked: false, empty: false };

  it("shows the other week's lesson on a row that differs", () => {
    expect(show(chemistry, physics, off)).toBe("Знаменник: Фізика · 7-А");
  });

  it("says the other week has no lesson on a one-sided row", () => {
    expect(show(chemistry, undefined, off)).toBe("Знаменник: уроку немає");
    expect(show(undefined, physics, off)).toBe("Знаменник: Фізика · 7-А");
  });

  it("is empty on a row equal in both weeks, a trailing space included", () => {
    expect(show(physics, { subject: "Фізика ", className: "7-А" }, off)).toBeUndefined();
  });

  it("is empty on a row empty in both weeks", () => {
    expect(show(undefined, undefined, off)).toBeUndefined();
  });

  it("names the numerator when the denominator is on the screen", () => {
    expect(shownLine(rowLine("OWN", "DENOMINATOR", chemistry, undefined), off)).toBe(
      "Чисельник: уроку немає",
    );
  });

  it("shows only the view's fields, the empty ones left out", () => {
    const line = rowLine(
      "CLASS",
      "NUMERATOR",
      undefined,
      { subject: "Фізика", teacherName: "Коваль О. П.", note: "Зошит" },
    );
    expect(line.off).toBe("Знаменник: Фізика · Коваль О. П. · Зошит");
  });
});

describe("the row's line with the toggle on", () => {
  const filled = { checked: true, empty: false };
  const empty = { checked: true, empty: true };

  it("adds a lesson where the other week has none", () => {
    expect(show(chemistry, undefined, filled)).toBe("додасть урок у знаменник");
    expect(show(undefined, undefined, filled)).toBe("додасть урок у знаменник");
  });

  it("replaces a different lesson in the other week", () => {
    expect(show(chemistry, physics, filled)).toBe("замінить «Фізика» у знаменнику");
  });

  it("says the changes reach the other week on a row equal in both", () => {
    expect(show(physics, physics, filled)).toBe("зміни запишуться і в знаменник");
  });

  it("removes the other week's lesson when the row is emptied — by hand or by the clear icon", () => {
    expect(show(physics, physics, empty)).toBe("видалить «Фізика» зі знаменника");
    expect(show(chemistry, physics, empty)).toBe("видалить «Фізика» зі знаменника");
  });

  it("says nothing when both are empty", () => {
    expect(show(undefined, undefined, empty)).toBeUndefined();
    expect(show(chemistry, undefined, empty)).toBeUndefined();
  });

  it("names the numerator from the denominator's side", () => {
    expect(shownLine(rowLine("OWN", "DENOMINATOR", physics, chemistry), empty)).toBe(
      "видалить «Хімія» з чисельника",
    );
  });
});

describe("which toggles T-047 leaves out", () => {
  it("leaves out the rows equal in both weeks and keeps the rows that differ", () => {
    const own = new Map<number, SlotPayload>([
      [1, physics],
      [2, chemistry],
      [3, physics],
    ]);
    const other = new Map<number, SlotPayload>([
      [1, { subject: " Фізика", className: "7-А" }],
      [2, physics],
    ]);

    // 1 equal, 2 differs, 3 one-sided, 4 empty in both.
    expect(untrackedToggles("OWN", [1, 2, 3, 4], own, other)).toEqual([
      templateBothWeeksField(1),
      templateBothWeeksField(4),
    ]);
  });
});

describe("whether a row is empty, as the save reads it", () => {
  it("reads a row of spaces as empty, so the line promises a removal", () => {
    // `rawSlotFields` trims, so a row of spaces saves as no lesson.
    expect(rowIsBlank([" ", "  "])).toBe(true);
    expect(
      show(physics, physics, { checked: true, empty: rowIsBlank([" ", ""]) }),
    ).toBe("видалить «Фізика» зі знаменника");
  });

  it("reads a row with any text as holding a lesson", () => {
    expect(rowIsBlank(["", "7-А"])).toBe(false);
  });
});
