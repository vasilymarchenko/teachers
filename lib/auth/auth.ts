import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db/client";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg" }),
    emailAndPassword: { enabled: true },
    // Must stay last in the list: it is an `after` hook that copies the
    // Set-Cookie better-auth produced onto Next's cookie store, which is the
    // only way `auth.api.signInEmail()` called from a Server Action can
    // establish a session. Without it sign-in succeeds and the browser keeps
    // no cookie.
    plugins: [nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/**
 * The better-auth instance, created on first use (same reason as `getDb()`).
 *
 * Nothing outside `lib/auth` and the mounted route handler should call this:
 * the rest of the app reads a session through `requireUser()` in `session.ts`,
 * which is the authorisation boundary (overview §8.3).
 */
export function getAuth() {
  return (instance ??= createAuth());
}
