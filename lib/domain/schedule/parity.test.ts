import { describe, expect, it } from "vitest";
import { eachIsoDateInRange } from "./dates";
import { FIXTURE } from "./fixtures/scenario";
import { parityOn } from "./parity";

/**
 * Every expectation comes from the table in
 * `docs/architecture/design/expand-fixtures.md` §5, which was computed by hand
 * from the overview §3.5 formula.
 */
describe("parityOn()", () => {
  const anchors = FIXTURE.anchors;

  // Fixtures §5, one case per row of the table.
  it.each([
    ["2026-10-12", "2026-10-18", "NUMERATOR", "A1, Δ 6 weeks"],
    ["2026-10-19", "2026-10-25", "DENOMINATOR", "A1, Δ 7 weeks"],
    ["2026-10-26", "2026-11-01", "NUMERATOR", "A1, Δ 8 weeks — the break week"],
    ["2026-11-02", "2026-11-03", "DENOMINATOR", "A1, Δ 9 weeks"],
    ["2026-11-04", "2026-11-08", "NUMERATOR", "A2, Δ 0 weeks"],
    ["2026-11-09", "2026-11-13", "DENOMINATOR", "A2, Δ 1 week"],
  ])("%s … %s is %s (%s)", (from, to, expected) => {
    for (const date of eachIsoDateInRange(from, to)) {
      expect(parityOn(date, anchors)).toBe(expected);
    }
  });

  // Fixtures §5, note 1 and §8.2 — the Q-001 default. These two dates are the
  // ones that flip if the answer becomes "a break week does not consume a
  // position": 2026-W44 is entirely non-teaching and still advances the counter.
  it("lets a full break week consume a parity position (Q-001 default)", () => {
    expect(parityOn("2026-10-26", anchors)).toBe("NUMERATOR");
    expect(parityOn("2026-11-02", anchors)).toBe("DENOMINATOR");
    expect(parityOn("2026-11-03", anchors)).toBe("DENOMINATOR");
  });

  // Fixtures §5, note 2 and §8.3, finding F-1.
  it("splits the week of an anchor that is not on a Monday", () => {
    expect(parityOn("2026-11-03", anchors)).toBe("DENOMINATOR");
    expect(parityOn("2026-11-04", anchors)).toBe("NUMERATOR");
  });

  // Fixtures §5, note 3: without A2 the week would be NUMERATOR (Δ 10, even).
  it("applies anchors after the first", () => {
    const firstAnchorOnly = anchors.slice(0, 1);
    expect(parityOn("2026-11-09", firstAnchorOnly)).toBe("NUMERATOR");
    expect(parityOn("2026-11-09", anchors)).toBe("DENOMINATOR");
  });

  // Not in the fixture: the window starts after A1, so nothing there pins what
  // happens before the earliest anchor. The alternation extends backwards from
  // it. §5 gives the week A1 falls in: `startOfISOWeek(2026-09-01) =
  // 2026-08-31` (2026-W36), so the Monday of A1's own week is still NUMERATOR
  // and 2026-W35 — Mon 2026-08-24 through Sun 2026-08-30 — is DENOMINATOR.
  it("extends the alternation backwards from the earliest anchor", () => {
    expect(parityOn("2026-09-01", anchors)).toBe("NUMERATOR");
    expect(parityOn("2026-08-31", anchors)).toBe("NUMERATOR");
    expect(parityOn("2026-08-30", anchors)).toBe("DENOMINATOR");
    expect(parityOn("2026-08-24", anchors)).toBe("DENOMINATOR");
  });

  it("refuses a year with no ParityAnchor at all", () => {
    expect(() => parityOn("2026-10-12", [])).toThrow(/no ParityAnchor/);
  });
});
