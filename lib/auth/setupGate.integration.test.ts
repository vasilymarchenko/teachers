import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { and, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { SETUP_GATE } from "@/components/year/labels";
import { createAcademicYearAction } from "@/lib/actions/academicYear";
import { closeDb } from "@/lib/db/client";
import { insertFixtureScenario } from "@/lib/db/fixtures/scenarioRows";
import { getSetupStatus } from "@/lib/db/queries/setupStatus";
import {
  academicYear,
  bellSchedule,
  parityAnchor,
  semester,
  user,
} from "@/lib/db/schema";
import { createTestDatabase } from "@/lib/db/testDatabase";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import { requireCompleteSetup } from "./setupGate";

/**
 * The year-setup gate, against a real database — T-038, overview §8.6.
 *
 * Two things are checked here that a unit test cannot hold. What
 * `getSetupStatus()` makes of the rows a teacher actually has, in each of the
 * states the ticket names. And that **every** page of the `(app)` group but
 * year setup answers an incomplete setup with a redirect to `/year`: the pages
 * are found by walking `app/(app)`, so a page added later without
 * `requireCompleteSetup()` fails here rather than in front of a teacher.
 *
 * A page is called as the async function it is, with the session and
 * `redirect()` replaced: the session because there is no request to carry a
 * cookie, `redirect()` so that where it points can be read. Everything between
 * the two — the gate, the queries, `expand()` — is the real code.
 *
 * Needs a migrated database — `npm run test:integration`.
 */

const { session, Redirected, NotFound } = vi.hoisted(() => {
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`redirect to ${url}`);
    }
  }
  class NotFound extends Error {}
  return { session: { userId: "" }, Redirected, NotFound };
});

vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({
    id: session.userId,
    email: `${session.userId}@example.test`,
    name: "Integration test",
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Redirected(url);
  },
  notFound: () => {
    throw new NotFound();
  },
}));

// Outside a request there is no cache to revalidate, and the call throws.
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { db, close } = createTestDatabase();

const createdUsers: string[] = [];

async function createUser(): Promise<string> {
  const id = `test-${randomUUID()}`;
  await db.insert(user).values({
    id,
    name: "Integration test",
    email: `${id}@example.test`,
    emailVerified: false,
  });
  createdUsers.push(id);
  return id;
}

afterAll(async () => {
  for (const id of createdUsers) {
    await db.delete(user).where(eq(user.id, id));
  }
  await close();
  await closeDb();
});

const YEAR = { dateFrom: "2026-09-01", dateTo: "2027-05-31" };
const SEMESTERS = [
  { index: 1, dateFrom: "2026-09-01", dateTo: "2026-12-24" },
  { index: 2, dateFrom: "2027-01-12", dateTo: "2027-05-31" },
];

/** Which of the four the teacher has; everything defaults to present. */
type Parts = {
  year?: boolean;
  initialAnchor?: boolean;
  semesters?: number;
  bells?: boolean;
};

/** A teacher with exactly the named parts of the year setup, and no others. */
async function createTeacher({
  year = true,
  initialAnchor = true,
  semesters = 2,
  bells = true,
}: Parts = {}): Promise<string> {
  const userId = await createUser();

  if (year) {
    const [row] = await db
      .insert(academicYear)
      .values({ userId, ...YEAR })
      .returning({ id: academicYear.id });

    if (semesters > 0) {
      await db.insert(semester).values(
        SEMESTERS.slice(0, semesters).map((row_) => ({
          userId,
          academicYearId: row.id,
          ...row_,
        })),
      );
    }
    if (initialAnchor) {
      await db
        .insert(parityAnchor)
        .values({ userId, date: YEAR.dateFrom, parity: "NUMERATOR" });
    }
  }
  if (bells) {
    await db
      .insert(bellSchedule)
      .values({ userId, lessonNumber: 1, timeFrom: "08:30", timeTo: "09:15" });
  }

  return userId;
}

const APP_GROUP = join(process.cwd(), "app", "(app)");

/** Every `page.tsx` under `app/(app)`, as an absolute file path. */
function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

/** The URL pattern a page answers on — route groups are invisible in it. */
function routeOf(file: string): string {
  const segments = relative(APP_GROUP, file)
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment));
  return `/${segments.join("/")}`;
}

const pages = pageFiles(APP_GROUP).map((file) => ({ file, route: routeOf(file) }));
const yearPage = pages.find((page) => page.route === "/year");
const gatedPages = pages.filter((page) => page.route !== "/year");

/**
 * Calls a page the way the framework would. One set of values serves every
 * dynamic segment the group has: a day inside the fixture year, lesson 1.
 */
async function open(file: string): Promise<unknown> {
  const page = (await import(/* @vite-ignore */ file)) as {
    default: (props: unknown) => Promise<unknown>;
  };
  return page.default({
    params: Promise.resolve({ view: "day", date: "2026-10-01", lessonNumber: "1" }),
    searchParams: Promise.resolve({}),
  });
}

/** Where the page sent the teacher, or `null` if it rendered. */
async function redirectOf(file: string): Promise<string | null> {
  try {
    await open(file);
    return null;
  } catch (error) {
    if (error instanceof Redirected) return error.url;
    if (error instanceof NotFound) return null;
    throw error;
  }
}

/** The five ways the ticket names of having an incomplete setup. */
const INCOMPLETE: [string, Parts][] = [
  ["no rows at all", { year: false, bells: false }],
  ["no AcademicYear", { year: false }],
  ["no initial ParityAnchor", { initialAnchor: false }],
  ["only one Semester", { semesters: 1 }],
  ["no BellSchedule", { bells: false }],
];

describe("the (app) group", () => {
  it("has the pages this suite is about", () => {
    // If the walk found nothing, every `it.each` below would pass vacuously.
    expect(yearPage).toBeDefined();
    expect(gatedPages.map((page) => page.route).sort()).toStrictEqual([
      "/calendar",
      "/calendar/[view]/[date]",
      "/calendar/[view]/[date]/lesson/[lessonNumber]",
      "/events",
      "/schedule",
    ]);
  });
});

describe.each(INCOMPLETE)("a teacher with %s", (_name, parts) => {
  it("is reported incomplete", async () => {
    const userId = await createTeacher(parts);

    expect((await getSetupStatus(userId)).complete).toBe(false);
  });

  it.each(gatedPages)("is sent from $route to year setup", async ({ file }) => {
    session.userId = await createTeacher(parts);

    expect(await redirectOf(file)).toBe("/year");
  });

  it("gets year setup itself, saying what is missing", async () => {
    session.userId = await createTeacher(parts);

    const element = (await open(yearPage!.file)) as React.ReactElement;
    const html = renderToStaticMarkup(element);

    expect(html).toContain(SETUP_GATE.title);
    expect(html).toContain(SETUP_GATE.missing);
    // No way out to a screen that would only send her back.
    expect(html).not.toContain('href="/calendar"');
  });
});

describe("what each of the four conditions looks at", () => {
  it("names the conditions a year meets, year by year", async () => {
    const userId = await createTeacher({ semesters: 1 });
    const [year] = await db
      .select({ id: academicYear.id })
      .from(academicYear)
      .where(eq(academicYear.userId, userId));

    expect(await getSetupStatus(userId)).toStrictEqual({
      complete: false,
      hasBellSchedule: true,
      years: [
        { academicYearId: year.id, hasInitialAnchor: true, hasBothSemesters: false },
      ],
    });
  });

  it("does not take a reset on another date for the initial ParityAnchor", async () => {
    const userId = await createTeacher({ initialAnchor: false });
    await db
      .insert(parityAnchor)
      .values({ userId, date: "2026-11-04", parity: "NUMERATOR" });

    const status = await getSetupStatus(userId);

    expect(status.years[0].hasInitialAnchor).toBe(false);
    expect(status.complete).toBe(false);
  });

  it("is satisfied by any one complete year", async () => {
    // ADR-018: next September being prepared — a year with no semesters yet —
    // must not close the calendar of the year being taught.
    const userId = await createTeacher();
    await db
      .insert(academicYear)
      .values({ userId, dateFrom: "2027-09-01", dateTo: "2028-05-31" });

    const status = await getSetupStatus(userId);

    expect(status.years.map((year) => year.hasBothSemesters)).toStrictEqual([
      true,
      false,
    ]);
    expect(status.complete).toBe(true);
  });

  it("reads none of another teacher's rows", async () => {
    await createTeacher();
    const strangerId = await createTeacher({ year: false, bells: false });

    expect(await getSetupStatus(strangerId)).toStrictEqual({
      complete: false,
      hasBellSchedule: false,
      years: [],
    });
  });
});

describe("a teacher whose setup is complete", () => {
  it("passes the gate and gets the session's user back", async () => {
    session.userId = await createTeacher();

    expect((await requireCompleteSetup()).id).toBe(session.userId);
  });

  it("is the teacher `npm run db:seed` produces", async () => {
    // `scripts/seed.ts` inserts exactly this scenario, so the demo teacher is
    // never behind the gate.
    const userId = await createUser();
    await insertFixtureScenario(userId, db);

    expect((await getSetupStatus(userId)).complete).toBe(true);
  });

  it.each(gatedPages)("is not sent to year setup from $route", async ({ file }) => {
    const userId = await createUser();
    await insertFixtureScenario(userId, db);
    session.userId = userId;

    expect(await redirectOf(file)).not.toBe("/year");
  });

  it("gets the ordinary year setup screen", async () => {
    session.userId = await createTeacher();

    const html = renderToStaticMarkup(
      (await open(yearPage!.file)) as React.ReactElement,
    );

    expect(html).not.toContain(SETUP_GATE.title);
    expect(html).not.toContain(SETUP_GATE.optional);
    expect(html).toContain('href="/calendar"');
  });
});

describe("undoing one of the four", () => {
  // The rows are removed directly: what is under test is that the status is
  // read again on every request, not which action removed the row.
  const undo: [string, (userId: string) => Promise<unknown>][] = [
    [
      "a Semester",
      (userId) =>
        db
          .delete(semester)
          .where(and(eq(semester.userId, userId), eq(semester.index, 2))),
    ],
    [
      "the last BellSchedule row",
      (userId) => db.delete(bellSchedule).where(eq(bellSchedule.userId, userId)),
    ],
    [
      "the last AcademicYear",
      (userId) => db.delete(academicYear).where(eq(academicYear.userId, userId)),
    ],
  ];

  it.each(undo)("deleting %s puts the teacher back behind the gate", async (_name, remove) => {
    session.userId = await createTeacher();
    await expect(requireCompleteSetup()).resolves.toBeDefined();

    await remove(session.userId);

    await expect(requireCompleteSetup()).rejects.toMatchObject({ url: "/year" });
    // …and year setup still opens, rather than failing in its turn.
    await expect(open(yearPage!.file)).resolves.toBeDefined();
  });
});

describe("createAcademicYearAction()", () => {
  it("writes the year and its initial ParityAnchor together", async () => {
    // The pairing the gate relies on: a year that exists has the anchor on its
    // first day, so a teacher past the gate cannot reach `expand()` with an
    // empty anchor list.
    session.userId = await createTeacher({ year: false });

    const form = new FormData();
    form.set("dateFrom", YEAR.dateFrom);
    form.set("dateTo", YEAR.dateTo);
    form.set("initialParity", "DENOMINATOR");

    await expect(
      createAcademicYearAction(EMPTY_FORM_STATE, form),
    ).rejects.toBeInstanceOf(Redirected);

    const anchors = await db
      .select({ date: parityAnchor.date, parity: parityAnchor.parity })
      .from(parityAnchor)
      .where(eq(parityAnchor.userId, session.userId));
    expect(anchors).toStrictEqual([
      { date: YEAR.dateFrom, parity: "DENOMINATOR" },
    ]);

    const status = await getSetupStatus(session.userId);
    expect(status.years).toStrictEqual([
      {
        academicYearId: expect.any(String),
        hasInitialAnchor: true,
        hasBothSemesters: false,
      },
    ]);
  });
});
