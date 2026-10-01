import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { isBadCredentials, TOO_MANY_SIGN_IN_ATTEMPTS, tooManyAttempts } from "./signInError";

/**
 * The line between "you typed the wrong password" and "this application is
 * broken". Getting it wrong in the permissive direction is what makes a
 * misconfigured deployment look like a teacher who forgot their password: the
 * form says the same thing either way and nothing reaches the logs.
 *
 * The codes below are the ones better-auth's `sign-in/email` route actually
 * raises — see `BASE_ERROR_CODES` and `api/routes/sign-in`.
 */
describe("isBadCredentials", () => {
  const errorWith = (
    status: "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "TOO_MANY_REQUESTS",
    code: string,
  ) =>
    new APIError(status, { message: code, code });

  it("accepts the code a wrong password, a wrong address and an unknown account all share", () => {
    expect(
      isBadCredentials(errorWith("UNAUTHORIZED", "INVALID_EMAIL_OR_PASSWORD")),
    ).toBe(true);
  });

  it("accepts better-auth's own rejection of the address", () => {
    expect(isBadCredentials(errorWith("BAD_REQUEST", "INVALID_EMAIL"))).toBe(true);
  });

  it("rejects an unverified email — a state, not a wrong password", () => {
    expect(isBadCredentials(errorWith("FORBIDDEN", "EMAIL_NOT_VERIFIED"))).toBe(false);
  });

  it("rejects a session that could not be created, though it is also a 401", () => {
    // The one that would otherwise slip through a check on the status alone.
    expect(
      isBadCredentials(errorWith("UNAUTHORIZED", "FAILED_TO_CREATE_SESSION")),
    ).toBe(false);
  });

  it("rejects an error carrying no code at all", () => {
    expect(isBadCredentials(new APIError("INTERNAL_SERVER_ERROR"))).toBe(false);
  });

  it("rejects the sign-in limit — the password was never looked at", () => {
    expect(
      isBadCredentials(errorWith("TOO_MANY_REQUESTS", TOO_MANY_SIGN_IN_ATTEMPTS)),
    ).toBe(false);
  });
});

describe("tooManyAttempts", () => {
  it("reads the wait out of the sign-in limit's refusal", () => {
    const refusal = new APIError("TOO_MANY_REQUESTS", {
      code: TOO_MANY_SIGN_IN_ATTEMPTS,
      message: "Too many sign-in attempts. Try again later.",
      retryAfter: 840,
    });
    expect(tooManyAttempts(refusal)).toBe(840);
  });

  it("is null for a wrong password", () => {
    const wrongPassword = new APIError("UNAUTHORIZED", {
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Invalid email or password",
    });
    expect(tooManyAttempts(wrongPassword)).toBeNull();
  });

  it("is null for an error carrying no code at all", () => {
    expect(tooManyAttempts(new APIError("INTERNAL_SERVER_ERROR"))).toBeNull();
  });
});
