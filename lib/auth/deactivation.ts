import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { session, user } from "@/lib/db/schema";

/**
 * The two halves of "a deactivated teacher holds no session" that run inside
 * better-auth's session creation — ADR-019. `auth.ts` registers them as
 * `databaseHooks.session.create.before` and `.after`; they live here so the
 * integration suite can call the second one on its own, at the one moment the
 * sign-in flow cannot be made to reach on demand.
 */

async function isDeactivated(userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ deactivatedAt: user.deactivatedAt })
    .from(user)
    .where(eq(user.id, userId));
  return row?.deactivatedAt != null;
}

/**
 * Refuses a session for a deactivated teacher, before it is created.
 *
 * The error is the wrong-password one, to the letter. better-auth verifies the
 * password before it creates a session, so this runs only when the password was
 * right; any code of its own would tell the caller that the account exists and
 * the guess was correct. `teachers.integration.test.ts` holds the two answers
 * equal.
 */
export async function refuseDeactivatedTeacher(created: { userId: string }): Promise<void> {
  if (await isDeactivated(created.userId)) {
    throw APIError.from("UNAUTHORIZED", {
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Invalid email or password",
    });
  }
}

/**
 * Ends a session that was created while its teacher was being deactivated.
 *
 * The check above and the INSERT that follows it are two statements, and
 * `deactivateTeacher()` can land between them: it sets `deactivated_at` and
 * sweeps the sessions, and the INSERT then arrives after the sweep. Looking
 * again once the row exists closes that. Either this read sees the column set
 * and deletes the row here, or `deactivated_at` was written after this read —
 * and then the sweep, which runs after that write, finds the row and deletes it
 * itself. The sign-in that lost the race has been answered with a cookie for a
 * session that no longer exists, which `requireUser()` treats as no session.
 */
export async function endSessionOfDeactivatedTeacher(created: {
  id: string;
  userId: string;
}): Promise<void> {
  if (await isDeactivated(created.userId)) {
    await getDb().delete(session).where(eq(session.id, created.id));
  }
}
