import type { APIError } from "better-auth/api";

/**
 * The error codes better-auth raises when the credentials themselves were
 * wrong, as opposed to when something went wrong.
 *
 * A bad address, a bad password and an unknown account all produce
 * `INVALID_EMAIL_OR_PASSWORD` — which is what lets the sign-in form answer all
 * three with one message without that message being a euphemism.
 * `INVALID_EMAIL` is better-auth's own parse of the address; Zod rejects those
 * first, so it is here for completeness rather than because it is reachable.
 */
const CREDENTIAL_ERROR_CODES = ["INVALID_EMAIL_OR_PASSWORD", "INVALID_EMAIL"];

/**
 * Whether an `APIError` from `signInEmail()` means "those credentials are
 * wrong" and nothing more.
 *
 * Everything else better-auth can raise here — an unverified email, a session
 * that could not be created, a rejected request — is a fault. Reporting a fault
 * as a wrong password leaves the teacher retyping a password that was right and
 * leaves nothing in the logs to find, which is why the caller rethrows instead.
 */
export function isBadCredentials(error: APIError): boolean {
  return CREDENTIAL_ERROR_CODES.includes(error.body?.code ?? "");
}
