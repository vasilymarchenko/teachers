import { describe, expect, it } from "vitest";
import {
  createSignInLimiter,
  SIGN_IN_MAX_FAILURES,
  SIGN_IN_WINDOW_SECONDS,
} from "./signInLimit";

/**
 * The counter behind the sign-in limit — T-016. The numbers asserted are the
 * ones `design/T-006-auth-boundary.md` §7 states: five attempts in a window of
 * fifteen minutes that opens with the first of them.
 */

const T0 = Date.UTC(2026, 9, 1, 8, 0, 0);
const seconds = (n: number) => n * 1000;

describe("the limit in force", () => {
  it("is five attempts in fifteen minutes", () => {
    expect(SIGN_IN_MAX_FAILURES).toBe(5);
    expect(SIGN_IN_WINDOW_SECONDS).toBe(900);
  });
});

describe("createSignInLimiter", () => {
  it("takes five attempts and refuses the sixth", () => {
    const limiter = createSignInLimiter();
    for (let n = 0; n < 5; n++) {
      expect(limiter.attempt("203.0.113.7", T0 + seconds(n))).toBeNull();
    }
    expect(limiter.attempt("203.0.113.7", T0 + seconds(5))).not.toBeNull();
  });

  it("says how long is left of the window, counted from its first attempt", () => {
    const limiter = createSignInLimiter();
    for (let n = 0; n < 5; n++) limiter.attempt("203.0.113.7", T0 + seconds(n * 10));
    // The window opened at T0 and ends at T0 + 900 s.
    expect(limiter.attempt("203.0.113.7", T0 + seconds(60))).toBe(840);
    expect(limiter.attempt("203.0.113.7", T0 + seconds(899))).toBe(1);
  });

  it("does not extend the window when a refused client keeps trying", () => {
    const limiter = createSignInLimiter();
    for (let n = 0; n < 5; n++) limiter.attempt("203.0.113.7", T0);
    limiter.attempt("203.0.113.7", T0 + seconds(600));
    expect(limiter.attempt("203.0.113.7", T0 + seconds(900))).toBeNull();
  });

  it("opens a new window of five once the fifteen minutes have passed", () => {
    const limiter = createSignInLimiter();
    for (let n = 0; n < 5; n++) limiter.attempt("203.0.113.7", T0);
    const later = T0 + seconds(900);
    for (let n = 0; n < 5; n++) {
      expect(limiter.attempt("203.0.113.7", later)).toBeNull();
    }
    expect(limiter.attempt("203.0.113.7", later)).toBe(900);
  });

  it("counts each address on its own", () => {
    const limiter = createSignInLimiter();
    for (let n = 0; n < 5; n++) limiter.attempt("203.0.113.7", T0);
    expect(limiter.attempt("203.0.113.7", T0)).not.toBeNull();
    expect(limiter.attempt("198.51.100.20", T0)).toBeNull();
  });

  it("starts from zero again after clear()", () => {
    const limiter = createSignInLimiter();
    for (let n = 0; n < 4; n++) limiter.attempt("203.0.113.7", T0);
    limiter.clear("203.0.113.7");
    for (let n = 0; n < 5; n++) {
      expect(limiter.attempt("203.0.113.7", T0 + seconds(1))).toBeNull();
    }
    expect(limiter.attempt("203.0.113.7", T0 + seconds(1))).not.toBeNull();
  });

  describe("at the ceiling on remembered addresses", () => {
    const rule = { max: 5, windowSeconds: 900, maxKeys: 2 };

    it("forgets an expired window before a live one", () => {
      const limiter = createSignInLimiter(rule);
      limiter.attempt("old", T0);
      for (let n = 0; n < 5; n++) limiter.attempt("live", T0 + seconds(600));
      // "old" has expired by now, "live" has not.
      limiter.attempt("new", T0 + seconds(900));
      expect(limiter.attempt("live", T0 + seconds(900))).not.toBeNull();
    });

    it("forgets the oldest window when all of them are live", () => {
      const limiter = createSignInLimiter(rule);
      for (let n = 0; n < 5; n++) limiter.attempt("first", T0);
      for (let n = 0; n < 5; n++) limiter.attempt("second", T0 + seconds(1));
      limiter.attempt("third", T0 + seconds(2));
      expect(limiter.attempt("second", T0 + seconds(3))).not.toBeNull();
      expect(limiter.attempt("first", T0 + seconds(3))).toBeNull();
    });
  });
});
