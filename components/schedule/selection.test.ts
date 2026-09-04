import { describe, expect, it } from "vitest";
import { pickTemplateSelection, templateHref } from "./selection";

/**
 * What the editor shows, read off the query string.
 */

describe("pickTemplateSelection", () => {
  it("takes all three switches from the URL", () => {
    expect(
      pickTemplateSelection(
        { view: "CLASS", parity: "DENOMINATOR", day: "FRI" },
        "MON",
      ),
    ).toEqual({ view: "CLASS", parity: "DENOMINATOR", weekday: "FRI" });
  });

  it("opens on «мої уроки», the numerator and today", () => {
    expect(pickTemplateSelection({}, "WED")).toEqual({
      view: "OWN",
      parity: "NUMERATOR",
      weekday: "WED",
    });
  });

  it("ignores a value that is not one of the enum's", () => {
    // Nothing is written from these, so a wrong one renders the default rather
    // than refusing the page.
    expect(
      pickTemplateSelection({ view: "OTHER", parity: "1", day: "MONDAY" }, "SAT"),
    ).toEqual({ view: "OWN", parity: "NUMERATOR", weekday: "SAT" });
  });

  it("ignores a repeated parameter rather than picking one of them", () => {
    expect(pickTemplateSelection({ view: ["OWN", "CLASS"] }, "TUE").view).toBe(
      "OWN",
    );
  });
});

describe("templateHref", () => {
  it("spells out all three, so a link restores the whole position", () => {
    expect(
      templateHref({ view: "CLASS", parity: "DENOMINATOR", weekday: "THU" }),
    ).toBe("/schedule?view=CLASS&parity=DENOMINATOR&day=THU");
  });
});
