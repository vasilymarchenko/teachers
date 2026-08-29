import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { user } from "@/lib/db/schema";

/**
 * The signed-in teacher's own row.
 *
 * The first function in this directory, and therefore the one that sets the
 * convention of overview §8.4: **`userId` is the first parameter of every query
 * and every mutation, and it comes only from `requireUser()`.** Never from a
 * form field, a search parameter or a route segment — the convention test in
 * `lib/auth/queryDiscipline.test.ts` fails the build over it.
 *
 * `user` is better-auth's table, so the tenant column is `id` rather than
 * `user_id`; on every profile table it is `user_id` and the filter is the same
 * one applied here.
 *
 * Returns `null` for a user id with no row — a session whose user was deleted
 * outlives the row by as long as the cookie lasts.
 */
export async function getTeacher(userId: string) {
  const [row] = await getDb()
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return row ?? null;
}
