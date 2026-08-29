import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db/client";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg" }),
    emailAndPassword: { enabled: true },
    // The one endpoint that creates an account without already holding a
    // session. `toNextJsHandler` publishes everything better-auth defines, and
    // `proxy.ts` deliberately does not cover `/api`, so leaving this mounted
    // lets anyone who can reach the host sign themselves up and hold a valid
    // session on a single-teacher app. There is no sign-up screen; the teacher
    // comes from `npm run db:seed`.
    //
    // `disabledPaths` and not `emailAndPassword.disableSignUp`: this closes the
    // route while leaving `auth.api.signUpEmail()` working, which is how the
    // seed creates the teacher with a hash better-auth will accept. The flag
    // would close both and push the seed onto better-auth's internals.
    disabledPaths: ["/sign-up/email"],
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
