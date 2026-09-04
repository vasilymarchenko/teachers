import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/lib/db/client";
import { insertFixtureScenario } from "@/lib/db/fixtures/scenarioRows";
import {
  academicYear,
  nonTeachingPeriod,
  nonTeachingWeekdayRule,
  parityAnchor,
  semester,
  user,
} from "@/lib/db/schema";
import { createTestDatabase } from "@/lib/db/testDatabase";
import {
  getAcademicYear,
  getWeekdayRule,
  listAcademicYears,
  listNonTeachingPeriods,
  listParityAnchors,
  listSemesters,
  listWeekdayRules,
} from "./yearSetup";

/**
 * The reads behind the year-setup screens, against the fixture scenario of
 * `docs/architecture/design/expand-fixtures.md` §3.
 *
 * Three properties are worth a live database. The order each list comes back
 * in, because the screen renders it in that order and it is not the order rows
 * were written. The two predicates that are easy to get wrong by one day — a
 * weekday rule that ends exactly where the year begins, and an anchor from the
 * year before. And the deliberate difference from the calendar's reads: a
 * period is selected by its year and not by its dates, so a period left outside
 * its year by an edit is still reachable.
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
  // These queries go through `getDb()`, whose pool would otherwise outlive the
  // run.
  await closeDb();
});

/** The fixture's Y1 — §3.1. */
const Y1 = { dateFrom: "2026-09-01", dateTo: "2027-05-31" };

async function fixtureYearId(): Promise<string> {
  const [year] = await listAcademicYears(userId);
  return year.id;
}

describe("listAcademicYears()", () => {
  it("returns the teacher's years with both ends of each", async () => {
    expect(await listAcademicYears(userId)).toStrictEqual([
      { id: expect.any(String), ...Y1 },
    ]);
  });

  it("returns them oldest first", async () => {
    const otherId = await createUser();

    try {
      // Written newest first, so an unordered read would hand the screen the
      // years in the wrong direction.
      await db.insert(academicYear).values([
        { userId: otherId, dateFrom: "2027-09-01", dateTo: "2028-05-31" },
        { userId: otherId, dateFrom: "2026-09-01", dateTo: "2027-05-31" },
      ]);

      expect(
        (await listAcademicYears(otherId)).map((year) => year.dateFrom),
      ).toStrictEqual(["2026-09-01", "2027-09-01"]);
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });

  it("returns nothing for a teacher who has set up no year", async () => {
    const strangerId = await createUser();

    try {
      expect(await listAcademicYears(strangerId)).toStrictEqual([]);
    } finally {
      await db.delete(user).where(eq(user.id, strangerId));
    }
  });
});

describe("getAcademicYear()", () => {
  it("returns the year", async () => {
    const id = await fixtureYearId();

    expect(await getAcademicYear(userId, id)).toStrictEqual({ id, ...Y1 });
  });

  it("returns none of another teacher's year", async () => {
    // The id is real; the teacher asking for it is not its owner. An id out of
    // a URL is not a claim (overview §8.4).
    const id = await fixtureYearId();
    const strangerId = await createUser();

    try {
      expect(await getAcademicYear(strangerId, id)).toBeNull();
    } finally {
      await db.delete(user).where(eq(user.id, strangerId));
    }
  });
});

describe("listSemesters()", () => {
  it("returns both semesters in index order", async () => {
    // Fixtures §3.1 — S1 and S2.
    const rows = await listSemesters(userId, await fixtureYearId());

    expect(rows).toStrictEqual([
      { id: expect.any(String), index: 1, dateFrom: "2026-09-01", dateTo: "2026-12-24" },
      { id: expect.any(String), index: 2, dateFrom: "2027-01-12", dateTo: "2027-05-31" },
    ]);
  });

  it("orders by index and not by insertion", async () => {
    const otherId = await createUser();

    try {
      const [year] = await db
        .insert(academicYear)
        .values({ userId: otherId, dateFrom: "2026-09-01", dateTo: "2027-05-31" })
        .returning();

      await db.insert(semester).values([
        { userId: otherId, academicYearId: year.id, index: 2, dateFrom: "2027-01-12", dateTo: "2027-05-31" },
        { userId: otherId, academicYearId: year.id, index: 1, dateFrom: "2026-09-01", dateTo: "2026-12-24" },
      ]);

      expect(
        (await listSemesters(otherId, year.id)).map((row) => row.index),
      ).toStrictEqual([1, 2]);
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });
});

describe("listNonTeachingPeriods()", () => {
  it("returns the year's periods in date order", async () => {
    // Fixtures §3.2 — P1 the one-day holiday, then P2 the break week.
    const rows = await listNonTeachingPeriods(userId, await fixtureYearId());

    expect(rows).toStrictEqual([
      {
        id: expect.any(String),
        kind: "PUBLIC_HOLIDAY",
        name: "День захисників і захисниць України",
        dateFrom: "2026-10-14",
        dateTo: "2026-10-14",
      },
      {
        id: expect.any(String),
        kind: "BREAK",
        name: "Осінні канікули",
        dateFrom: "2026-10-26",
        dateTo: "2026-11-01",
      },
    ]);
  });

  it("still returns a period that lies outside its year", async () => {
    // The teacher shortened the year after entering the break. The calendar's
    // range read drops it, and it must stay editable here — otherwise it is a
    // row no screen can reach.
    const otherId = await createUser();

    try {
      const [year] = await db
        .insert(academicYear)
        .values({ userId: otherId, dateFrom: "2026-09-01", dateTo: "2026-12-31" })
        .returning();

      await db.insert(nonTeachingPeriod).values({
        userId: otherId,
        academicYearId: year.id,
        kind: "BREAK",
        name: "Весняні канікули",
        dateFrom: "2027-03-22",
        dateTo: "2027-03-28",
      });

      expect(
        (await listNonTeachingPeriods(otherId, year.id)).map((row) => row.name),
      ).toStrictEqual(["Весняні канікули"]);
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });
});

describe("listWeekdayRules()", () => {
  it("returns the rules in force during the year, with the kind they were entered as", async () => {
    // Fixtures §3.3 — R1 the methodical Friday, R2/R3 the weekend.
    const rows = await listWeekdayRules(userId, { from: Y1.dateFrom, to: Y1.dateTo });

    expect(rows).toStrictEqual([
      {
        id: expect.any(String),
        weekday: "FRI",
        validFrom: "2026-09-01",
        boundaryDate: "2026-10-26",
        boundaryKind: "NEXT_BREAK",
      },
      {
        id: expect.any(String),
        weekday: "SAT",
        validFrom: "2026-09-01",
        boundaryDate: "2027-06-01",
        boundaryKind: "DATE",
      },
      {
        id: expect.any(String),
        weekday: "SUN",
        validFrom: "2026-09-01",
        boundaryDate: "2027-06-01",
        boundaryKind: "DATE",
      },
    ]);
  });

  it("excludes a rule that ends exactly where the window starts", async () => {
    // `boundary_date` is exclusive: a rule ending on 2026-09-01 covers nothing
    // on or after it, so it is last year's rule and not this year's.
    const otherId = await createUser();

    try {
      await db.insert(nonTeachingWeekdayRule).values([
        { userId: otherId, weekday: "FRI", validFrom: "2026-06-01", boundaryDate: "2026-09-01", boundaryKind: "DATE" },
        { userId: otherId, weekday: "MON", validFrom: "2026-06-01", boundaryDate: "2026-09-02", boundaryKind: "DATE" },
      ]);

      expect(
        (await listWeekdayRules(otherId, { from: Y1.dateFrom, to: Y1.dateTo })).map(
          (row) => row.weekday,
        ),
      ).toStrictEqual(["MON"]);
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });
});

describe("getWeekdayRule()", () => {
  it("returns the rule with the day it started on", async () => {
    // The edit path needs `validFrom`: the new boundary resolves against it and
    // not against today (ADR-004).
    const [rule] = await listWeekdayRules(userId, { from: Y1.dateFrom, to: Y1.dateTo });

    expect(await getWeekdayRule(userId, rule.id)).toStrictEqual(rule);
  });

  it("returns none of another teacher's rule", async () => {
    const [rule] = await listWeekdayRules(userId, { from: Y1.dateFrom, to: Y1.dateTo });
    const strangerId = await createUser();

    try {
      expect(await getWeekdayRule(strangerId, rule.id)).toBeNull();
    } finally {
      await db.delete(user).where(eq(user.id, strangerId));
    }
  });
});

describe("listParityAnchors()", () => {
  it("returns the anchors inside the year, in date order", async () => {
    // Fixtures §3.5 — A1 the year's initial value, A2 the mid-week reset.
    const rows = await listParityAnchors(userId, { from: Y1.dateFrom, to: Y1.dateTo });

    expect(rows).toStrictEqual([
      { id: expect.any(String), date: "2026-09-01", parity: "NUMERATOR" },
      { id: expect.any(String), date: "2026-11-04", parity: "NUMERATOR" },
    ]);
  });

  it("excludes an anchor from before the year", async () => {
    // Unlike `getParityAnchors()`, which reaches back to find the anchor in
    // force, this is a list to edit: the previous year's anchor is edited there.
    const otherId = await createUser();

    try {
      await db.insert(parityAnchor).values([
        { userId: otherId, date: "2026-08-31", parity: "DENOMINATOR" },
        { userId: otherId, date: "2026-09-01", parity: "NUMERATOR" },
      ]);

      expect(
        (await listParityAnchors(otherId, { from: Y1.dateFrom, to: Y1.dateTo })).map(
          (row) => row.date,
        ),
      ).toStrictEqual(["2026-09-01"]);
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });
});
