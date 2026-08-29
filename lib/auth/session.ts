import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";

/** The signed-in teacher, as far as the rest of the app is concerned. */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * The current session's user, or `null` when there is none.
 *
 * For the few places that legitimately render both ways (a sign-in page that
 * bounces an already-signed-in teacher). Anything that reads or writes data
 * uses `requireUser()` instead.
 */
export async function getUser(): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
}

/**
 * The authorisation boundary — overview §8.3.
 *
 * Called at the entry of every Server Action and every query. It is the single
 * source of `userId`: a `userId` that came from a form field, a search
 * parameter or a route segment is an authorisation bug, and the convention
 * test in `lib/auth/queryDiscipline.test.ts` fails the build over it
 * (overview §8.4).
 *
 * `redirect()` throws, so control never returns to the caller without a user.
 * The redirect makes an expired session land on the sign-in page rather than on
 * an error; `proxy.ts` usually gets there first, but that layer is UX and this
 * is the check that actually holds.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return user;
}
