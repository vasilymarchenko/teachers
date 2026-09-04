import { describe, expect, it } from "vitest";
import { capToNextVersion, planTemplateEdit } from "./copyOnWrite";

/**
 * The two template writes of `docs/architecture/design/expand-fixtures.md` §3.8,
 * replayed. The intervals they must produce are the ones §3.6 stores.
 *
 * `now` is an instant, not a date: `planTemplateEdit` resolves it through
 * `lib/time/today.ts`, so these tests pin the clock without being able to hand
 * the function a cut date (overview §3.2, I1).
 */

/** 2026-10-21 12:00 in Kyiv. */
const ON_2026_10_21 = new Date("2026-10-21T09:00:00Z");
/** 2026-11-02 12:00 in Kyiv. */
const ON_2026_11_02 = new Date("2026-11-02T10:00:00Z");

describe("planTemplateEdit()", () => {
  // §3.8, 2026-10-21: OWN-V1 was [2026-09-01, 2026-12-25) and is trimmed to the
  // cut; OWN-V2 becomes [2026-10-21, 2026-12-25). This is I1 and I2 together.
  it("trims the version in force at today() and creates the new one there", () => {
    expect(
      planTemplateEdit({
        current: {
          id: "OWN-V1",
          validFrom: "2026-09-01",
          validTo: "2026-12-25",
        },
        validTo: "2026-12-25",
        now: ON_2026_10_21,
      }),
    ).toStrictEqual({
      cutAt: "2026-10-21",
      trim: { id: "OWN-V1", validTo: "2026-10-21" },
      create: { validFrom: "2026-10-21", validTo: "2026-12-25" },
    });
  });

  // §3.8, 2026-11-02: CLASS-V1 had already ended on 2026-10-21, so there is no
  // version in force, I2 trims nothing, and the gap survives.
  it("creates without trimming when a gap is in force", () => {
    expect(
      planTemplateEdit({ validTo: "2026-12-25", now: ON_2026_11_02 }),
    ).toStrictEqual({
      cutAt: "2026-11-02",
      create: { validFrom: "2026-11-02", validTo: "2026-12-25" },
    });
  });

  // Trimming a version that starts today would leave [d, d), which
  // `schedule_template_range_ck` rejects — there is no past to freeze.
  it("replaces a version that started today instead of trimming it", () => {
    expect(
      planTemplateEdit({
        current: {
          id: "OWN-V2",
          validFrom: "2026-10-21",
          validTo: "2026-12-25",
        },
        validTo: "2026-12-25",
        now: ON_2026_10_21,
      }),
    ).toStrictEqual({
      cutAt: "2026-10-21",
      replace: { id: "OWN-V2" },
      create: { validFrom: "2026-10-21", validTo: "2026-12-25" },
    });
  });

  // The cut is today() and only today(): a version beginning later is not the
  // one in force, and editing the past is impossible by design (I1).
  it("refuses a version that begins after the cut", () => {
    expect(() =>
      planTemplateEdit({
        current: {
          id: "OWN-V3",
          validFrom: "2026-11-01",
          validTo: "2026-12-25",
        },
        validTo: "2026-12-25",
        now: ON_2026_10_21,
      }),
    ).toThrow(/begins after the cut/);
  });

  // The mirror of the case above, and the one a stale read produces: CLASS-V1
  // had ended on 2026-10-21 by the time of the 2026-11-02 write. Passing it as
  // `current` would trim it to the cut — moving `validTo` forward and closing
  // the gap §3.6 stores — so it is refused rather than silently rewritten.
  it("refuses a version that ended before the cut", () => {
    expect(() =>
      planTemplateEdit({
        current: {
          id: "CLASS-V1",
          validFrom: "2026-09-01",
          validTo: "2026-10-21",
        },
        validTo: "2026-12-25",
        now: ON_2026_11_02,
      }),
    ).toThrow(/ended before the cut/);
  });

  it("refuses a validTo that is not after the cut", () => {
    expect(() =>
      planTemplateEdit({ validTo: "2026-10-21", now: ON_2026_10_21 }),
    ).toThrow(/not after the cut/);
  });
});

describe("capToNextVersion", () => {
  // The half of overview §3.2 `planTemplateEdit()` leaves to the editor: a
  // version that starts after the cut is not planned against, but the new
  // version may not run over it either.
  it("stops the new version where the later one starts", () => {
    expect(capToNextVersion("2026-12-25", "2026-11-02")).toBe("2026-11-02");
  });

  it("leaves the bound alone when the later version starts after it", () => {
    // Two versions with a gap between them — legal, and not this function's to
    // close (§3.2).
    expect(capToNextVersion("2026-10-21", "2026-11-02")).toBe("2026-10-21");
  });

  it("leaves the bound alone when there is no later version", () => {
    expect(capToNextVersion("2026-12-25", undefined)).toBe("2026-12-25");
  });

  it("keeps the two ends apart when they would meet exactly", () => {
    expect(capToNextVersion("2026-11-02", "2026-11-02")).toBe("2026-11-02");
  });
});
