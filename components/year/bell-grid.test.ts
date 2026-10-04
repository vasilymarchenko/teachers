import { describe, expect, it } from "vitest";
import { bellGridChanged } from "./bell-grid";

/**
 * The bell grid's own report to `TrackedForm` — T-047. The grid is controlled,
 * so it answers from its state against the stored rows instead of the DOM.
 */
const STORED = [
  { lessonNumber: 1, timeFrom: "08:30", timeTo: "09:15" },
  { lessonNumber: 2, timeFrom: "09:25", timeTo: "10:10" },
];
const starts = (one: string, two: string) => ({ 1: one, 2: two });

describe("bellGridChanged()", () => {
  it("is unchanged as the grid opens", () => {
    expect(bellGridChanged(STORED, "45", starts("08:30", "09:25"))).toBe(false);
  });

  // `8:30` is what the action stores as `08:30`.
  it("is unchanged by a start that the save spells as the stored one", () => {
    expect(bellGridChanged(STORED, "45", starts("8:30", "925"))).toBe(false);
  });

  it("reports a moved start", () => {
    expect(bellGridChanged(STORED, "45", starts("08:35", "09:25"))).toBe(true);
  });

  it("reports a cleared start, which deletes the lesson number", () => {
    expect(bellGridChanged(STORED, "45", starts("08:30", ""))).toBe(true);
  });

  it("reports a start added to an unused number", () => {
    expect(
      bellGridChanged(STORED, "45", { ...starts("08:30", "09:25"), 3: "10:30" }),
    ).toBe(true);
  });

  it("reports a new length, which moves every end", () => {
    expect(bellGridChanged(STORED, "40", starts("08:30", "09:25"))).toBe(true);
  });

  it("reports a length that does not parse, so its message can be asked for", () => {
    expect(bellGridChanged(STORED, "сорок", starts("08:30", "09:25"))).toBe(
      true,
    );
  });

  // Stored rows of different lengths: the field shows the first, and saving
  // would rewrite the second to it.
  it("opens as changed when the stored lengths differ", () => {
    const mixed = [STORED[0], { ...STORED[1], timeTo: "10:05" }];
    expect(bellGridChanged(mixed, "45", starts("08:30", "09:25"))).toBe(true);
  });

  it("is unchanged by an empty grid with nothing stored", () => {
    expect(bellGridChanged([], "45", {})).toBe(false);
  });
});
