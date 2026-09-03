import { describe, expect, it } from "vitest";
import { parityAnchorInput } from "./parityAnchor";

/**
 * Specification §4 as the form's boundary — «скидання після канікул».
 *
 * There is nothing to reject here beyond shape: which dates are legal for a
 * reset depends on the year it belongs to, and the action is what has the year.
 */

describe("parityAnchorInput", () => {
  it("accepts the fixture's mid-week reset", () => {
    // Fixtures §3.5 — A2, a Wednesday: an anchor need not fall on a Monday
    // (schema §4.6, fixtures §5 F-1).
    const reset = { date: "2026-11-04", parity: "NUMERATOR" };

    expect(parityAnchorInput.parse(reset)).toStrictEqual(reset);
  });

  it("accepts a reset to the denominator", () => {
    expect(
      parityAnchorInput.safeParse({ date: "2026-11-02", parity: "DENOMINATOR" }).success,
    ).toBe(true);
  });

  it("names the missing date", () => {
    const parsed = parityAnchorInput.safeParse({ date: "", parity: "NUMERATOR" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]).toMatchObject({
      path: ["date"],
      message: "Виберіть дату, з якої починається новий відлік",
    });
  });

  it("rejects a parity value the database does not have", () => {
    const parsed = parityAnchorInput.safeParse({ date: "2026-11-04", parity: "" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe("Оберіть, з чого починається відлік");
  });
});
