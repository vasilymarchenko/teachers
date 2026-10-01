import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db/client";
import { endSessionOfDeactivatedTeacher, refuseDeactivatedTeacher } from "./deactivation";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg" }),
    emailAndPassword: { enabled: true },
    // The one endpoint that creates an account without already holding a
    // session. `toNextJsHandler` publishes everything better-auth defines, and
    // `proxy.ts` deliberately does not cover `/api`, so leaving this mounted
    // lets anyone who can reach the host sign themselves up and hold a valid
    // session on a single-teacher app. There is no sign-up screen; a teacher
    // comes from `npm run teacher -- create` (`lib/auth/teachers.ts`), and the
    // demo teacher from `npm run db:seed`.
    //
    // `disabledPaths` and not `emailAndPassword.disableSignUp`: this closes the
    // route while leaving `auth.api.signUpEmail()` working, which is how both
    // of those create a teacher with a hash better-auth will accept. The flag
    // would close both and push them onto better-auth's internals.
    disabledPaths: ["/sign-up/email"],
    // A deactivated teacher holds no session — ADR-019. In better-auth's own
    // hooks and not in `signInAction`, so that the mounted
    // `POST /api/auth/sign-in/email` is refused by the same check as the form.
    // Two hooks, because the first alone leaves a gap — `deactivation.ts`.
    databaseHooks: {
      session: {
        create: {
          before: refuseDeactivatedTeacher,
          after: endSessionOfDeactivatedTeacher,
        },
      },
    },
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
