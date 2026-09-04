import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/lib/db/client";
import { insertFixtureScenario } from "@/lib/db/fixtures/scenarioRows";
import { academicYear, semester, user } from "@/lib/db/schema";
import { createTestDatabase } from "@/lib/db/testDatabase";
import { getUpcomingYearFrame, getYearFrame } from "./yearFrame";

/**
 * The year frame read — schema §4.1 and §4.2, and the one read of T-008 whose
 * result nothing else asserts: `getScheduleInput()` does not call it, so without
 * this the only thing checked about it is its query plan.
 *
 * Two properties are worth pinning. The semesters come back in `index` order,
 * which is what `resolveBoundary()` reads as "semester 1, then semester 2" and
 * is not the order rows happen to be inserted in. And a date outside every year
 * is `null`, not an error: an August day before year setup has run is a normal
 * thing to navigate to.
 *
 * Needs a migrated database — `npm run test:integration`.
 */

const { db, close } = createTestDatabase();

let userId: string;

async function createUser(): Promise<string> {
  const id = `test-${randomUUID()}`;
  await db.insert(user).values({
    id,
    name: "Integration test",
    email: `${id}@example.test`,
    emailVerified: false,
  });
  return id;
}

beforeAll(async () => {
  userId = await createUser();
  await insertFixtureScenario(userId, db);
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
  await close();
  // `getYearFrame()` goes through `getDb()`, whose pool would otherwise outlive
  // the run.
  await closeDb();
});

describe("getYearFrame()", () => {
  it("returns the year covering the date, with both semesters", async () => {
    // Fixtures §3.1 — Y1 and its two semesters.
    const frame = await getYearFrame(userId, "2026-11-10");

    expect(frame).toStrictEqual({
      id: expect.any(String),
      dateFrom: "2026-09-01",
      dateTo: "2027-05-31",
      semesters: [
        { dateFrom: "2026-09-01", dateTo: "2026-12-24" },
        { dateFrom: "2027-01-12", dateTo: "2027-05-31" },
      ],
    });
  });

  it("includes both ends of the year", async () => {
    // Entity range, both ends inclusive (schema §6).
    expect(await getYearFrame(userId, "2026-09-01")).not.toBeNull();
    expect(await getYearFrame(userId, "2027-05-31")).not.toBeNull();
  });

  it("returns null for a date outside every year", async () => {
    // The day before the year opens, and the day after it closes.
    expect(await getYearFrame(userId, "2026-08-31")).toBeNull();
    expect(await getYearFrame(userId, "2027-06-01")).toBeNull();
  });

});

describe("getUpcomingYearFrame()", () => {
  // The setup order ADR-004 calls the ordinary case: on an August day the
  // teacher has entered September but is not inside it yet, and «до кінця
  // семестру» has to resolve against the year about to begin rather than be
  // refused with «спершу задайте навчальний рік».
  it("returns the year about to begin, with both semesters", async () => {
    const frame = await getUpcomingYearFrame(userId, "2026-08-24");

    expect(frame).toStrictEqual({
      id: expect.any(String),
      dateFrom: "2026-09-01",
      dateTo: "2027-05-31",
      semesters: [
        { dateFrom: "2026-09-01", dateTo: "2026-12-24" },
        { dateFrom: "2027-01-12", dateTo: "2027-05-31" },
      ],
    });
  });

  it("takes the earliest year that begins after the date", async () => {
    const otherId = await createUser();

    try {
      // Written later-first, so a read that trusted insertion order would
      // resolve a boundary against 2029 while 2028 is the one about to start.
      await db.insert(academicYear).values([
        { userId: otherId, dateFrom: "2029-09-01", dateTo: "2030-05-31" },
        { userId: otherId, dateFrom: "2028-09-01", dateTo: "2029-05-31" },
      ]);

      expect(
        (await getUpcomingYearFrame(otherId, "2028-08-24"))?.dateFrom,
      ).toBe("2028-09-01");
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });

  it("excludes a year that has already started", async () => {
    // Strictly after: a year whose first day is the date itself is the year in
    // force, and `getYearFrame()` is what answers for it.
    expect(await getUpcomingYearFrame(userId, "2026-09-01")).toBeNull();
  });

  it("returns null when nothing has been set up ahead", async () => {
    // The one case that really is «спершу задайте навчальний рік».
    expect(await getUpcomingYearFrame(userId, "2027-06-01")).toBeNull();
  });
});

describe("getYearFrame(), continued", () => {
  it("orders the semesters by index, not by insertion", async () => {
    const otherId = await createUser();

    try {
      const [year] = await db
        .insert(academicYear)
        .values({ userId: otherId, dateFrom: "2027-09-01", dateTo: "2028-05-31" })
        .returning();

      // Semester 2 written first: an unordered read would hand
      // `resolveBoundary()` the second semester as the first.
      await db.insert(semester).values([
        { userId: otherId, academicYearId: year.id, index: 2, dateFrom: "2028-01-12", dateTo: "2028-05-31" },
        { userId: otherId, academicYearId: year.id, index: 1, dateFrom: "2027-09-01", dateTo: "2027-12-24" },
      ]);

      const frame = await getYearFrame(otherId, "2027-10-01");

      expect(frame?.semesters).toStrictEqual([
        { dateFrom: "2027-09-01", dateTo: "2027-12-24" },
        { dateFrom: "2028-01-12", dateTo: "2028-05-31" },
      ]);
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });

  it("returns none of another teacher's year", async () => {
    const otherId = await createUser();
    await insertFixtureScenario(otherId, db);

    try {
      // The other teacher's Y1 covers this date too; this one has no year at all.
      const strangerId = await createUser();
      try {
        expect(await getYearFrame(strangerId, "2026-11-10")).toBeNull();
      } finally {
        await db.delete(user).where(eq(user.id, strangerId));
      }
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });
});
