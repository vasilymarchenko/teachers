import { randomUUID } from "node:crypto";
import { count, eq, inArray } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInAction } from "@/lib/actions/auth";
import { closeDb } from "@/lib/db/client";
import { insertFixtureScenario } from "@/lib/db/fixtures/scenarioRows";
import {
  academicYear,
  account,
  bellSchedule,
  dayOverride,
  parityAnchor,
  scheduleTemplate,
  session as sessionTable,
  user,
} from "@/lib/db/schema";
import { createTestDatabase } from "@/lib/db/testDatabase";
import { getAuth } from "./auth";
import { endSessionOfDeactivatedTeacher } from "./deactivation";
import { requireUser } from "./session";
import {
  activateTeacher,
  createTeacher,
  deactivateTeacher,
  listTeachers,
  setTeacherPassword,
} from "./teachers";

/**
 * Teacher accounts, against a real database and the real better-auth — T-039,
 * ADR-019.
 *
 * The operations reach into better-auth's exposed internals, so nothing here is
 * asserted on a mock of them: a password counts as set when better-auth's own
 * sign-in accepts it, and a teacher counts as deactivated when better-auth's
 * own sign-in and session lookup refuse her.
 *
 * Sign-in is exercised over three paths, because the ticket makes a claim about
 * each: `auth.api.signInEmail()`, the server call; `auth.handler()` with a
 * `POST /api/auth/sign-in/email` request, which is what the mounted route
 * serves; and `signInAction`, which is the form. Only the request-bound pieces
 * of Next are replaced — the header store, because there is no request, and
 * `redirect()`, so that where it points can be read.
 *
 * The two points ADR-019 §Consequences records as inferred and not run are the
 * tests named "reaches the caller of signInEmail() as an APIError" and "a
 * session cookie issued before deactivation".
 *
 * Needs a migrated database — `npm run test:integration`.
 */

const { request, Redirected } = vi.hoisted(() => {
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`redirect to ${url}`);
    }
  }
  return { request: { headers: new Headers() }, Redirected };
});

vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  // `nextCookies()` copies better-auth's Set-Cookie here after a sign-in.
  cookies: async () => ({ set: () => undefined }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));

const { db, close } = createTestDatabase();

const ORIGIN = "http://localhost:3000";
const PASSWORD = "first-password-1";
const createdEmails: string[] = [];

function newEmail(): string {
  const email = `t039-${randomUUID()}@example.test`;
  createdEmails.push(email);
  return email;
}

/** A teacher made by the operation under test, never by an INSERT. */
async function newTeacher(password = PASSWORD) {
  const email = newEmail();
  const result = await createTeacher({ email, name: "Олена Шевченко", password });
  if (!result.ok) throw new Error(`createTeacher refused: ${result.reason}`);
  const [row] = await db.select().from(user).where(eq(user.email, email));
  return { email, userId: row.id };
}

// Sign-ins are limited per client address (`signInLimit.ts`), and this file
// fails more of them than one address is allowed. The limit is not what is
// under test here, so every test signs in from an address of its own.
let testNumber = 0;
let clientIp = "";
beforeEach(() => {
  testNumber += 1;
  clientIp = `198.51.100.${testNumber}`;
});

afterAll(async () => {
  if (createdEmails.length > 0) {
    await db.delete(user).where(inArray(user.email, createdEmails));
  }
  await close();
  await closeDb();
});

/** `POST /api/auth/sign-in/email`, as the mounted route handler receives it. */
async function signInOverHttp(email: string, password: string) {
  const response = await getAuth().handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        "x-forwarded-for": clientIp,
      },
      body: JSON.stringify({ email, password }),
    }),
  );
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { status: response.status, body: (await response.json()) as unknown, cookie };
}

/** What `auth.api.signInEmail()` throws, reduced to what a caller can see. */
async function signInApiError(email: string, password: string) {
  try {
    await getAuth().api.signInEmail({
      body: { email, password },
      headers: new Headers({ "x-forwarded-for": clientIp }),
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    return { status: error.status, statusCode: error.statusCode, body: error.body };
  }
  throw new Error("signInEmail() was expected to throw and created a session instead");
}

async function submitSignInForm(email: string, password: string) {
  request.headers = new Headers({ "x-forwarded-for": clientIp });
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  return signInAction({}, form);
}

async function sessionCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(sessionTable)
    .where(eq(sessionTable.userId, userId));
  return row.n;
}

async function passwordHash(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(eq(account.userId, userId));
  return row.password;
}

/** How many rows of her own a teacher has, per table. */
async function ownedRows(userId: string): Promise<Record<string, number>> {
  const tables = { academicYear, bellSchedule, dayOverride, parityAnchor, scheduleTemplate };
  const counts: Record<string, number> = {};
  for (const [name, table] of Object.entries(tables)) {
    const [row] = await db.select({ n: count() }).from(table).where(eq(table.userId, userId));
    counts[name] = row.n;
  }
  return counts;
}

describe("createTeacher", () => {
  it("creates a teacher who signs in with the password she was given", async () => {
    const { email, userId } = await newTeacher();

    const signIn = await getAuth().api.signInEmail({ body: { email, password: PASSWORD } });
    expect(signIn.user.email).toBe(email);

    const [row] = await db.select().from(user).where(eq(user.id, userId));
    expect(row.deactivatedAt).toBeNull();
  });

  it("leaves no session behind from the sign-up it goes through", async () => {
    const { userId } = await newTeacher();
    expect(await sessionCount(userId)).toBe(0);
  });

  it("refuses an address that exists, in any letter case, and writes nothing", async () => {
    const { email, userId } = await newTeacher();
    const hashBefore = await passwordHash(userId);

    for (const taken of [email, email.toUpperCase()]) {
      const result = await createTeacher({ email: taken, name: "Інша", password: "another-password-2" });
      expect(result).toEqual({ ok: false, reason: "email-taken" });
    }

    const rows = await db.select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Олена Шевченко");
    expect(await passwordHash(userId)).toBe(hashBefore);
  });

  it("refuses a password outside better-auth's bounds before anything is written", async () => {
    for (const [password, reason] of [
      ["seven77", "password-too-short"],
      ["x".repeat(129), "password-too-long"],
    ] as const) {
      const email = newEmail();
      const result = await createTeacher({ email, name: "Олена", password });

      expect(result).toEqual({ ok: false, reason, min: 8, max: 128 });
      expect(await db.select().from(user).where(eq(user.email, email))).toEqual([]);
    }
  });

  it("refuses what is not an address", async () => {
    const result = await createTeacher({ email: "not-an-address", name: "Олена", password: PASSWORD });
    expect(result).toEqual({ ok: false, reason: "invalid-email" });
  });
});

describe("setTeacherPassword", () => {
  it("makes the new password sign in, the old one not, and ends every session", async () => {
    const { email, userId } = await newTeacher();
    const held = await signInOverHttp(email, PASSWORD);
    expect(held.status).toBe(200);
    expect(await sessionCount(userId)).toBe(1);

    const result = await setTeacherPassword(email, "second-password-2");
    expect(result.ok).toBe(true);

    expect(await sessionCount(userId)).toBe(0);
    expect(
      await getAuth().api.getSession({ headers: new Headers({ cookie: held.cookie }) }),
    ).toBeNull();

    expect((await signInApiError(email, PASSWORD)).body?.code).toBe("INVALID_EMAIL_OR_PASSWORD");
    const signIn = await getAuth().api.signInEmail({
      body: { email, password: "second-password-2" },
    });
    expect(signIn.user.email).toBe(email);
  });

  it("refuses a password outside the bounds and leaves the old one working", async () => {
    const { email, userId } = await newTeacher();
    const hashBefore = await passwordHash(userId);
    await signInOverHttp(email, PASSWORD);

    expect(await setTeacherPassword(email, "seven77")).toEqual({
      ok: false,
      reason: "password-too-short",
      min: 8,
      max: 128,
    });
    expect(await setTeacherPassword(email, "x".repeat(129))).toEqual({
      ok: false,
      reason: "password-too-long",
      min: 8,
      max: 128,
    });

    expect(await passwordHash(userId)).toBe(hashBefore);
    // Not even the sessions were touched.
    expect(await sessionCount(userId)).toBe(1);
  });
});

describe("deactivateTeacher", () => {
  it("sets deactivated_at and deletes no row of the teacher's data", async () => {
    const { email, userId } = await newTeacher();
    await insertFixtureScenario(userId, db);
    const before = await ownedRows(userId);
    for (const n of Object.values(before)) expect(n).toBeGreaterThan(0);

    const result = await deactivateTeacher(email);

    expect(result).toMatchObject({ ok: true, teacher: { email, active: false } });
    const [row] = await db.select().from(user).where(eq(user.id, userId));
    expect(row.deactivatedAt).toBeInstanceOf(Date);
    expect(await ownedRows(userId)).toEqual(before);
    expect(await passwordHash(userId)).not.toBeNull();
  });

  it("sends a session cookie issued before deactivation to /sign-in", async () => {
    const { email } = await newTeacher();
    const held = await signInOverHttp(email, PASSWORD);

    request.headers = new Headers({ cookie: held.cookie });
    expect((await requireUser()).email).toBe(email);

    await deactivateTeacher(email);

    await expect(requireUser()).rejects.toMatchObject({ url: "/sign-in" });
    expect(
      await getAuth().api.getSession({ headers: new Headers({ cookie: held.cookie }) }),
    ).toBeNull();
  });

  it("reaches the caller of signInEmail() as an APIError, the wrong-password one", async () => {
    const { email } = await newTeacher();
    const wrongPassword = await signInApiError(email, "not-the-password");
    expect(wrongPassword.body?.code).toBe("INVALID_EMAIL_OR_PASSWORD");

    await deactivateTeacher(email);

    // The password is right: this is the hook refusing, not the password check.
    expect(await signInApiError(email, PASSWORD)).toEqual(wrongPassword);
    expect(await signInApiError(email, "not-the-password")).toEqual(wrongPassword);
  });

  it("answers POST /api/auth/sign-in/email exactly as for a wrong password, and issues no session", async () => {
    const { email, userId } = await newTeacher();
    const wrongPassword = await signInOverHttp(email, "not-the-password");
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toMatchObject({ code: "INVALID_EMAIL_OR_PASSWORD" });

    await deactivateTeacher(email);

    for (const password of [PASSWORD, "not-the-password"]) {
      const refused = await signInOverHttp(email, password);
      expect(refused.status).toBe(wrongPassword.status);
      expect(refused.body).toEqual(wrongPassword.body);
      expect(refused.cookie).toBe("");
    }
    // An address nobody has is answered the same way, so nothing above tells a
    // caller that this account exists.
    const unknown = await signInOverHttp(`nobody-${randomUUID()}@example.test`, PASSWORD);
    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.body).toEqual(wrongPassword.body);

    expect(await sessionCount(userId)).toBe(0);
  });

  it("shows the sign-in form the wrong-password message, not the error page", async () => {
    const { email } = await newTeacher();
    const wrongPassword = await submitSignInForm(email, "not-the-password");
    expect(wrongPassword).toEqual({ email, error: "Неправильна електронна пошта або пароль" });

    await deactivateTeacher(email);

    // Had the hook's error not been a credential error, `signInAction` would
    // rethrow it and the teacher would see the error page.
    expect(await submitSignInForm(email, PASSWORD)).toEqual(wrongPassword);
    expect(await submitSignInForm(email, "not-the-password")).toEqual(wrongPassword);
  });

  it("ends a session that was inserted after the sweep, by a sign-in that had already been let through", async () => {
    // The interleaving cannot be produced through sign-in on demand, so it is
    // laid out by hand: the teacher is deactivated and her sessions swept, and
    // only then does the session of a sign-in that passed the first check
    // arrive. The second hook is what better-auth calls at that point.
    const { email, userId } = await newTeacher();
    const other = await newTeacher();
    await deactivateTeacher(email);

    const late = { id: `late-${randomUUID()}`, userId };
    const kept = { id: `kept-${randomUUID()}`, userId: other.userId };
    for (const row of [late, kept]) {
      await db.insert(sessionTable).values({
        ...row,
        token: `token-${row.id}`,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-10-01T00:00:00.000Z"),
      });
    }

    await endSessionOfDeactivatedTeacher(late);
    await endSessionOfDeactivatedTeacher(kept);

    expect(await sessionCount(userId)).toBe(0);
    // An active teacher's session is left alone.
    expect(await sessionCount(other.userId)).toBe(1);
  });

  it("keeps the moment of the first deactivation when repeated", async () => {
    const { email, userId } = await newTeacher();
    await deactivateTeacher(email);
    const [first] = await db.select().from(user).where(eq(user.id, userId));

    expect((await deactivateTeacher(email)).ok).toBe(true);

    const [second] = await db.select().from(user).where(eq(user.id, userId));
    expect(second.deactivatedAt).toEqual(first.deactivatedAt);
  });
});

describe("activateTeacher", () => {
  it("lets the teacher sign in again and find her data as it was", async () => {
    const { email, userId } = await newTeacher();
    await insertFixtureScenario(userId, db);
    const before = await ownedRows(userId);
    await deactivateTeacher(email);

    const result = await activateTeacher(email);

    expect(result).toMatchObject({ ok: true, teacher: { email, active: true } });
    const [row] = await db.select().from(user).where(eq(user.id, userId));
    expect(row.deactivatedAt).toBeNull();

    await expect(submitSignInForm(email, PASSWORD)).rejects.toMatchObject({ url: "/" });
    const held = await signInOverHttp(email, PASSWORD);
    expect(held.status).toBe(200);
    request.headers = new Headers({ cookie: held.cookie });
    expect((await requireUser()).id).toBe(userId);

    expect(await ownedRows(userId)).toEqual(before);
  });
});

describe("an address that does not exist", () => {
  it("is refused by password, deactivate and activate, and nothing is written", async () => {
    const email = `nobody-${randomUUID()}@example.test`;
    const [{ n: usersBefore }] = await db.select({ n: count() }).from(user);

    expect(await setTeacherPassword(email, PASSWORD)).toEqual({ ok: false, reason: "not-found" });
    expect(await deactivateTeacher(email)).toEqual({ ok: false, reason: "not-found" });
    expect(await activateTeacher(email)).toEqual({ ok: false, reason: "not-found" });

    const [{ n: usersAfter }] = await db.select({ n: count() }).from(user);
    expect(usersAfter).toBe(usersBefore);
    expect(await db.select().from(user).where(eq(user.email, email))).toEqual([]);
  });
});

describe("listTeachers", () => {
  it("gives each teacher's address, name, whether active and when created — and nothing else", async () => {
    const active = await newTeacher();
    const deactivated = await newTeacher();
    await deactivateTeacher(deactivated.email);

    const teachers = await listTeachers();

    const first = teachers.find((teacher) => teacher.email === active.email);
    const second = teachers.find((teacher) => teacher.email === deactivated.email);
    expect(first).toEqual({
      email: active.email,
      name: "Олена Шевченко",
      active: true,
      createdAt: expect.any(Date),
    });
    expect(second).toMatchObject({ email: deactivated.email, active: false });

    for (const teacher of teachers) {
      expect(Object.keys(teacher).sort()).toEqual(["active", "createdAt", "email", "name"]);
    }
    const hash = await passwordHash(active.userId);
    expect(hash).not.toBeNull();
    expect(JSON.stringify(teachers)).not.toContain(hash);
  });
});
