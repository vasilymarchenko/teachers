import { APIError, createAuthMiddleware, getIP, isAPIError } from "better-auth/api";
import { isBadCredentials, TOO_MANY_SIGN_IN_ATTEMPTS } from "./signInError";

/**
 * The limit on repeated failed sign-ins — T-016, ADR-023. `auth.ts` registers
 * the two hooks at the bottom as `hooks.before` and `hooks.after`; better-auth
 * runs those for `auth.api.signInEmail()` and for the mounted
 * `POST /api/auth/sign-in/email` alike, so the form and the route are counted
 * by one counter. better-auth's own limiter is not that: it sits in the
 * router's `onRequest` and never sees the call the form makes.
 */

/** Sign-ins one client address may fail inside one window. */
export const SIGN_IN_MAX_FAILURES = 5;

/** The window, counted from the first attempt in it. */
export const SIGN_IN_WINDOW_SECONDS = 15 * 60;

/**
 * How many addresses are remembered at once. The store lives in the process, so
 * it needs a ceiling; past it the oldest windows are forgotten first.
 */
const MAX_TRACKED_KEYS = 10_000;

/** The path the limit applies to, as better-auth names it. */
const SIGN_IN_PATH = "/sign-in/email";

/**
 * The key for a request whose address cannot be told — no forwarded header, or
 * one that is not a single trustworthy address. All such requests share it:
 * an unknown client is limited together with every other unknown client
 * rather than not at all.
 */
const UNKNOWN_CLIENT = "unknown";

type Window = { count: number; startedAt: number };

export type SignInLimiter = {
  /**
   * Takes one attempt for `key`. `null` when it was taken; otherwise the
   * seconds until the window that is full ends.
   */
  attempt(key: string, now: number): number | null;
  /**
   * Gives one attempt back to `key` — for an attempt that turned out not to be
   * a failed guess. One, not all of them: the others were.
   */
  release(key: string): void;
};

export function createSignInLimiter(
  rule: { max: number; windowSeconds: number; maxKeys: number } = {
    max: SIGN_IN_MAX_FAILURES,
    windowSeconds: SIGN_IN_WINDOW_SECONDS,
    maxKeys: MAX_TRACKED_KEYS,
  },
): SignInLimiter {
  const windowMs = rule.windowSeconds * 1000;
  const windows = new Map<string, Window>();

  const makeRoom = (now: number) => {
    if (windows.size < rule.maxKeys) return;
    for (const [key, window] of windows) {
      if (now - window.startedAt >= windowMs) windows.delete(key);
    }
    // Still full of live windows: a Map iterates in insertion order, so the
    // first keys are the oldest.
    for (const key of windows.keys()) {
      if (windows.size < rule.maxKeys) break;
      windows.delete(key);
    }
  };

  return {
    attempt(key, now) {
      const window = windows.get(key);
      if (!window || now - window.startedAt >= windowMs) {
        // Deleted first so that a restarted window moves to the end of the
        // insertion order and is not the next one evicted.
        windows.delete(key);
        makeRoom(now);
        windows.set(key, { count: 1, startedAt: now });
        return null;
      }
      if (window.count >= rule.max) {
        return Math.ceil((window.startedAt + windowMs - now) / 1000);
      }
      window.count += 1;
      return null;
    },
    release(key) {
      const window = windows.get(key);
      if (!window) return;
      window.count -= 1;
      if (window.count <= 0) windows.delete(key);
    },
  };
}

// On `globalThis`, not in a module variable: Next may load this module once
// for the Server Action and once for the route handler, and two stores would
// be two allowances.
const STORE = Symbol.for("teachers.signInLimiter");
const holder = globalThis as typeof globalThis & { [STORE]?: SignInLimiter };

function limiter(): SignInLimiter {
  return (holder[STORE] ??= createSignInLimiter());
}

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

function clientKey(ctx: HookContext): string {
  // `auth.api.signInEmail()` carries no Request, only the headers its caller
  // passed — and none at all when the caller passed none.
  const source = ctx.request ?? ctx.headers;
  return (source && getIP(source, ctx.context.options)) || UNKNOWN_CLIENT;
}

/**
 * Takes an attempt before the password is looked at, and refuses once the
 * window is full.
 *
 * Before, not after a failure: a burst of parallel guesses would otherwise all
 * be checked ahead of the first failure being recorded. So the refusal depends
 * on the address alone — it is the same for a right password, a wrong one and
 * an account that does not exist.
 */
export const refuseRepeatedSignIn = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== SIGN_IN_PATH) return;
  const retryAfter = limiter().attempt(clientKey(ctx), Date.now());
  if (retryAfter === null) return;
  throw new APIError(
    "TOO_MANY_REQUESTS",
    {
      code: TOO_MANY_SIGN_IN_ATTEMPTS,
      message: "Too many sign-in attempts. Try again later.",
      retryAfter,
    },
    { "Retry-After": String(retryAfter) },
  );
});

/**
 * Gives the attempt back unless it was a failed guess, which is what makes the
 * count one of failures.
 *
 * A failed guess is the credential error and nothing else. A sign-in that
 * succeeded gets its one attempt back — not the whole address forgiven, or
 * anyone holding an account could wipe the count between guesses at someone
 * else's. Every other `APIError` gets it back too: a request better-auth turned
 * away for its origin or its shape never reached the password, and counting it
 * would let a page on another site spend the attempts of whoever opened it.
 *
 * The refusal above never arrives here — better-auth runs no `after` hook for a
 * request a `before` hook threw on — so nothing is given back for an attempt
 * that was not taken.
 */
export const returnSignInAttempt = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== SIGN_IN_PATH) return;
  const returned = ctx.context.returned;
  if (isAPIError(returned) && isBadCredentials(returned)) return;
  limiter().release(clientKey(ctx));
});
