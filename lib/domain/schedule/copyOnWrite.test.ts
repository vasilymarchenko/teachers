import { describe, expect, it } from "vitest";
import { planTemplateEdit } from "./copyOnWrite";

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

  it("refuses a validTo that is not after the cut", () => {
    expect(() =>
      planTemplateEdit({ validTo: "2026-10-21", now: ON_2026_10_21 }),
    ).toThrow(/not after the cut/);
  });
});
