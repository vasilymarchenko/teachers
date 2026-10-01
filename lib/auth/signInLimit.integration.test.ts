import { randomUUID } from "node:crypto";
import { count, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { signInAction } from "@/lib/actions/auth";
import { closeDb } from "@/lib/db/client";
import { session as sessionTable, user } from "@/lib/db/schema";
import { createTestDatabase } from "@/lib/db/testDatabase";
import { getAuth } from "./auth";
import { TOO_MANY_SIGN_IN_ATTEMPTS } from "./signInError";
import { createTeacher } from "./teachers";

/**
 * The sign-in limit, against a real database and the real better-auth — T-016,
 * ADR-023.
 *
 * What is asserted is what `design/T-006-auth-boundary.md` §7 states: five
 * attempts per client address, the sixth refused whatever it carries, one
 * counter for the form and for `POST /api/auth/sign-in/email`. The form is
 * `signInAction` and the route is `auth.handler()`, as in
 * `teachers.integration.test.ts`; only the request-bound pieces of Next are
 * replaced.
 *
 * The counter is one per process and nothing here resets it, so every test
 * signs in from an address of its own.
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
const PASSWORD = "right-password-1";
const WRONG_PASSWORD = "wrong-password-1";
const WRONG_PASSWORD_MESSAGE = "Неправильна електронна пошта або пароль";
// The window is fifteen minutes and the refusal comes within the first second
// of it, so the wait rounds up to the whole window.
const WAIT_MESSAGE = "Забагато спроб входу. Спробуйте ще раз через 15 хв.";
const createdEmails: string[] = [];

async function newTeacher() {
  const email = `t016-${randomUUID()}@example.test`;
  createdEmails.push(email);
  const result = await createTeacher({ email, name: "Олена Шевченко", password: PASSWORD });
  if (!result.ok) throw new Error(`createTeacher refused: ${result.reason}`);
  const [row] = await db.select().from(user).where(eq(user.email, email));
  return { email, userId: row.id };
}

afterAll(async () => {
  if (createdEmails.length > 0) {
    await db.delete(user).where(inArray(user.email, createdEmails));
  }
  await close();
  await closeDb();
});

/** The form, submitted from `ip` — the address Caddy would have forwarded. */
async function submitSignInForm(ip: string, email: string, password: string) {
  request.headers = new Headers({ "x-forwarded-for": ip });
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  return signInAction({}, form);
}

/** `POST /api/auth/sign-in/email` from `ip`, as the mounted route handler receives it. */
async function signInOverHttp(ip: string, email: string, password: string) {
  const response = await getAuth().handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": ip },
      body: JSON.stringify({ email, password }),
    }),
  );
  return {
    status: response.status,
    retryAfter: response.headers.get("retry-after"),
    cookies: response.headers.getSetCookie(),
    body: (await response.json()) as { code?: string },
  };
}

async function sessionCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(sessionTable)
    .where(eq(sessionTable.userId, userId));
  return row.n;
}

describe("the sign-in form", () => {
  it("reports five wrong passwords as wrong, then refuses the sixth attempt though its password is right", async () => {
    const { email, userId } = await newTeacher();
    const ip = "203.0.113.1";

    for (let n = 0; n < 5; n++) {
      expect(await submitSignInForm(ip, email, WRONG_PASSWORD)).toEqual({
        email,
        error: WRONG_PASSWORD_MESSAGE,
      });
    }

    expect(await submitSignInForm(ip, email, PASSWORD)).toEqual({ email, error: WAIT_MESSAGE });
    expect(await sessionCount(userId)).toBe(0);
  });

  it("refuses an address nobody has with the same words as one that exists", async () => {
    const { email } = await newTeacher();
    const nobody = `t016-nobody-${randomUUID()}@example.test`;

    for (let n = 0; n < 5; n++) await submitSignInForm("203.0.113.2", email, WRONG_PASSWORD);
    for (let n = 0; n < 5; n++) await submitSignInForm("203.0.113.3", nobody, WRONG_PASSWORD);

    const existing = await submitSignInForm("203.0.113.2", email, WRONG_PASSWORD);
    const unknown = await submitSignInForm("203.0.113.3", nobody, WRONG_PASSWORD);
    expect(existing.error).toBe(WAIT_MESSAGE);
    expect(unknown.error).toBe(WAIT_MESSAGE);
  });

  it("does not count a sign-in that succeeded", async () => {
    const { email } = await newTeacher();
    const ip = "203.0.113.4";

    for (let n = 0; n < 5; n++) {
      await expect(submitSignInForm(ip, email, PASSWORD)).rejects.toBeInstanceOf(Redirected);
    }
    for (let n = 0; n < 5; n++) {
      expect((await submitSignInForm(ip, email, WRONG_PASSWORD)).error).toBe(
        WRONG_PASSWORD_MESSAGE,
      );
    }
    expect((await submitSignInForm(ip, email, WRONG_PASSWORD)).error).toBe(WAIT_MESSAGE);
  });

  it("does not let a sign-in to one account forgive the failures against another", async () => {
    const victim = await newTeacher();
    const own = await newTeacher();
    const ip = "203.0.113.10";

    // Four guesses at someone else's password, then a sign-in to one's own
    // account — the loop that would never reach five if success cleared the
    // address.
    for (let n = 0; n < 4; n++) await submitSignInForm(ip, victim.email, WRONG_PASSWORD);
    await expect(submitSignInForm(ip, own.email, PASSWORD)).rejects.toBeInstanceOf(Redirected);

    expect((await submitSignInForm(ip, victim.email, WRONG_PASSWORD)).error).toBe(
      WRONG_PASSWORD_MESSAGE,
    );
    expect((await submitSignInForm(ip, victim.email, WRONG_PASSWORD)).error).toBe(WAIT_MESSAGE);
  });

  it("leaves another client address alone", async () => {
    const { email } = await newTeacher();

    for (let n = 0; n < 6; n++) await submitSignInForm("203.0.113.5", email, WRONG_PASSWORD);

    await expect(submitSignInForm("203.0.113.6", email, PASSWORD)).rejects.toBeInstanceOf(
      Redirected,
    );
  });
});

describe("POST /api/auth/sign-in/email", () => {
  it("answers five wrong passwords with 401, then the sixth attempt with 429 though its password is right", async () => {
    const { email, userId } = await newTeacher();
    const ip = "203.0.113.7";

    for (let n = 0; n < 5; n++) {
      const wrong = await signInOverHttp(ip, email, WRONG_PASSWORD);
      expect(wrong.status).toBe(401);
      expect(wrong.body.code).toBe("INVALID_EMAIL_OR_PASSWORD");
    }

    const refused = await signInOverHttp(ip, email, PASSWORD);
    expect(refused.status).toBe(429);
    expect(refused.body.code).toBe(TOO_MANY_SIGN_IN_ATTEMPTS);
    expect(Number(refused.retryAfter)).toBeGreaterThan(890);
    expect(Number(refused.retryAfter)).toBeLessThanOrEqual(900);
    expect(refused.cookies).toEqual([]);
    expect(await sessionCount(userId)).toBe(0);
  });
});

describe("a request better-auth turns away before the password", () => {
  // The case this exists for is a cross-site form post from the teacher's own
  // browser, which better-auth refuses for its origin only after `hooks.before`
  // has taken an attempt from her address. That refusal cannot be produced
  // here — better-auth skips its origin check when NODE_ENV is "test" — so the
  // request below is one it refuses in every environment, for its shape. Both
  // reach the `after` hook the same way: as an `APIError` that is not the
  // credential error.
  it("costs the address nothing", async () => {
    const { email } = await newTeacher();
    const ip = "203.0.113.11";

    for (let n = 0; n < 6; n++) {
      const response = await getAuth().handler(
        new Request(`${ORIGIN}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": ip },
          body: JSON.stringify({ email }),
        }),
      );
      expect(response.status).toBe(400);
    }

    await expect(submitSignInForm(ip, email, PASSWORD)).rejects.toBeInstanceOf(Redirected);
  });
});

describe("the form and the route", () => {
  it("share one counter: failures over the route close the form", async () => {
    const { email } = await newTeacher();
    const ip = "203.0.113.8";

    for (let n = 0; n < 5; n++) await signInOverHttp(ip, email, WRONG_PASSWORD);

    expect(await submitSignInForm(ip, email, PASSWORD)).toEqual({ email, error: WAIT_MESSAGE });
  });

  it("share one counter: failures in the form close the route", async () => {
    const { email } = await newTeacher();
    const ip = "203.0.113.9";

    for (let n = 0; n < 5; n++) await submitSignInForm(ip, email, WRONG_PASSWORD);

    expect((await signInOverHttp(ip, email, PASSWORD)).status).toBe(429);
  });
});
