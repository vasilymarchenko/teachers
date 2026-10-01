import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { getAuth } from "./auth";

/**
 * Teacher accounts — ADR-019.
 *
 * The five operations account management consists of, as plain functions: they
 * take their input as arguments and return a result. None reads `process.env`,
 * prompts or prints, which is what lets the console command
 * (`scripts/teacher`) be the caller today and a Server Action be a second one
 * later, with no account logic in either.
 *
 * A refusal the caller can cause — an address that is taken, one that does not
 * exist, a password out of bounds — comes back as `{ ok: false }` and nothing
 * has been written. Anything else is a fault and is thrown.
 *
 * `auth.$context` and its `internalAdapter` are better-auth's exposed
 * internals, not its documented API. `teachers.integration.test.ts` signs in
 * for real after every operation that touches a password or a session, because
 * a type-check does not prove the stored hash is one sign-in accepts.
 */

/** What the callers may know about a teacher. Nothing derived from a password. */
export type Teacher = {
  email: string;
  name: string;
  active: boolean;
  createdAt: Date;
};

export type TeacherRefusal =
  | { ok: false; reason: "invalid-email" }
  | { ok: false; reason: "email-taken" }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "password-too-short" | "password-too-long"; min: number; max: number };

export type TeacherResult = { ok: true; teacher: Teacher } | TeacherRefusal;

const teacherColumns = {
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt,
  deactivatedAt: user.deactivatedAt,
};

type TeacherRow = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  deactivatedAt: Date | null;
};

function toTeacher(row: TeacherRow): Teacher {
  return {
    email: row.email,
    name: row.name,
    active: row.deactivatedAt === null,
    createdAt: row.createdAt,
  };
}

// better-auth stores an address lower-cased and looks it up the same way.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findByEmail(email: string): Promise<TeacherRow | undefined> {
  const [row] = await getDb()
    .select(teacherColumns)
    .from(user)
    .where(eq(user.email, normalizeEmail(email)));
  return row;
}

/**
 * The bounds better-auth itself holds a password to — read from its context
 * rather than restated, so a change to `emailAndPassword` in `auth.ts` moves
 * this check with it.
 */
async function checkPassword(password: string): Promise<TeacherRefusal | null> {
  const { minPasswordLength: min, maxPasswordLength: max } = (await getAuth().$context).password
    .config;
  if (password.length < min) return { ok: false, reason: "password-too-short", min, max };
  if (password.length > max) return { ok: false, reason: "password-too-long", min, max };
  return null;
}

/**
 * Creates a teacher with no data: she starts on an empty `/year` screen
 * (overview §8.6).
 */
export async function createTeacher(input: {
  email: string;
  name: string;
  password: string;
}): Promise<TeacherResult> {
  const email = normalizeEmail(input.email);
  if (!z.email().safeParse(email).success) return { ok: false, reason: "invalid-email" };

  const refusal = await checkPassword(input.password);
  if (refusal) return refusal;

  if (await findByEmail(email)) return { ok: false, reason: "email-taken" };

  // Through better-auth's own sign-up rather than an INSERT into its tables, so
  // the account row and the hash are what sign-in expects.
  const signUp = await getAuth().api.signUpEmail({
    body: { email, name: input.name, password: input.password },
  });

  // Sign-up signs the new user in. Nobody holds that session — there was no
  // request to carry its cookie — so it is removed rather than left to expire.
  await (await getAuth().$context).internalAdapter.deleteUserSessions(signUp.user.id);

  const created = await findByEmail(email);
  if (!created) throw new Error(`Teacher ${email} was created and cannot be read back.`);
  return { ok: true, teacher: toTeacher(created) };
}

/**
 * Replaces a teacher's password and ends every session she held, so the old
 * password stops working everywhere at once.
 */
export async function setTeacherPassword(email: string, password: string): Promise<TeacherResult> {
  const refusal = await checkPassword(password);
  if (refusal) return refusal;

  const row = await findByEmail(email);
  if (!row) return { ok: false, reason: "not-found" };

  const context = await getAuth().$context;
  await context.internalAdapter.updatePassword(row.id, await context.password.hash(password));
  await context.internalAdapter.deleteUserSessions(row.id);

  return { ok: true, teacher: toTeacher(row) };
}

/**
 * Stops a teacher signing in and ends her sessions. Every row she owns stays.
 *
 * The column first, the sessions second: once `deactivated_at` is set no new
 * session can be created (`auth.ts`), so nothing can slip in between the two.
 * Session cookie caching is off, so a deleted session row takes effect on the
 * next request (ADR-019).
 *
 * Deactivating a teacher who already is keeps the moment it first happened.
 */
export async function deactivateTeacher(email: string): Promise<TeacherResult> {
  const row = await findByEmail(email);
  if (!row) return { ok: false, reason: "not-found" };

  const [updated] = await getDb()
    .update(user)
    .set({ deactivatedAt: sql`coalesce(${user.deactivatedAt}, now())` })
    .where(eq(user.id, row.id))
    .returning(teacherColumns);

  await (await getAuth().$context).internalAdapter.deleteUserSessions(row.id);

  return { ok: true, teacher: toTeacher(updated) };
}

/** Lets a deactivated teacher sign in again, to the data as she left it. */
export async function activateTeacher(email: string): Promise<TeacherResult> {
  const row = await findByEmail(email);
  if (!row) return { ok: false, reason: "not-found" };

  const [updated] = await getDb()
    .update(user)
    .set({ deactivatedAt: null })
    .where(eq(user.id, row.id))
    .returning(teacherColumns);

  return { ok: true, teacher: toTeacher(updated) };
}

/** Every teacher, oldest account first. */
export async function listTeachers(): Promise<Teacher[]> {
  const rows = await getDb()
    .select(teacherColumns)
    .from(user)
    .orderBy(asc(user.createdAt), asc(user.email));
  return rows.map(toTeacher);
}
