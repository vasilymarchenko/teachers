import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/lib/db/client";
import { event, user } from "@/lib/db/schema";
import { createTestDatabase } from "@/lib/db/testDatabase";
import { getEvent, getEventsInRange, listEvents } from "./events";

/**
 * `Event` for a range — schema §4.10, and the half of it the date index cannot
 * find.
 *
 * The fixture scenario has no events (fixtures §3), so these rows are the
 * test's own. Titles are Ukrainian because the teacher reads them.
 *
 * Needs a migrated database — `npm run test:integration`.
 */

const { db, close } = createTestDatabase();

let userId: string;

/** 2026-W45, the fixture window's last full week. */
const WINDOW = { from: "2026-11-09", to: "2026-11-15" };

const titles = (rows: { title: string }[]) => rows.map((row) => row.title).sort();

beforeAll(async () => {
  userId = `test-${randomUUID()}`;
  await db.insert(user).values({
    id: userId,
    name: "Integration test",
    email: `${userId}@example.test`,
    emailVerified: false,
  });

  await db.insert(event).values([
    // Inside the window.
    { userId, kind: "DEADLINE", title: "Здати звіт", dateFrom: "2026-11-10", done: false },
    // Outside it on either side.
    { userId, kind: "DEADLINE", title: "Минулий дедлайн", dateFrom: "2026-11-08", done: false },
    { userId, kind: "DEADLINE", title: "Майбутній дедлайн", dateFrom: "2026-11-16", done: true },
    // A multi-day INFO that only touches the window on its last day.
    { userId, kind: "INFO", title: "Тиждень науки", dateFrom: "2026-11-02", dateTo: "2026-11-09" },
    // The same, one day earlier: it ends the day before the window starts.
    { userId, kind: "INFO", title: "Ярмарок", dateFrom: "2026-11-01", dateTo: "2026-11-08" },
    // Recurring, and dated far outside the window — the case the plain date
    // index cannot find (schema §4.10).
    {
      userId,
      kind: "INFO",
      title: "День золотої рибки",
      dateFrom: "2026-09-13",
      recurrenceKind: "YEARLY",
      boundaryDate: "2027-06-01",
      boundaryKind: "DATE",
    },
    // Recurring, but its validity ended before the window opened.
    {
      userId,
      kind: "INFO",
      title: "Осінній гурток",
      dateFrom: "2026-09-01",
      recurrenceKind: "WEEKLY",
      boundaryDate: "2026-11-09",
      boundaryKind: "NEXT_BREAK",
    },
  ]);
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
  await close();
  await closeDb();
});

describe("getEventsInRange()", () => {
  it("returns the one-off events overlapping the window and no others", async () => {
    const rows = await getEventsInRange(userId, WINDOW);

    expect(titles(rows.filter((row) => row.recurrenceKind === "NONE"))).toStrictEqual([
      "Здати звіт",
      "Тиждень науки",
    ]);
  });

  it("returns a recurring event whose date_from is outside the window", async () => {
    // «День золотої рибки» is 13 September; its November occurrence exists only
    // because the event recurs, and T-012 is what turns it into a date.
    const rows = await getEventsInRange(userId, WINDOW);

    expect(titles(rows.filter((row) => row.recurrenceKind !== "NONE"))).toStrictEqual([
      "День золотої рибки",
    ]);
  });

  it("excludes a recurring event whose boundary_date has passed", async () => {
    // `boundary_date` is exclusive (schema §6): a rule ending 2026-11-09 does
    // not apply on 2026-11-09, and «Осінній гурток» must not come back for a
    // window starting that day.
    const rows = await getEventsInRange(userId, WINDOW);

    expect(titles(rows)).not.toContain("Осінній гурток");
  });

  it("includes an event that only touches the first day of the window", async () => {
    const rows = await getEventsInRange(userId, { from: "2026-11-09", to: "2026-11-09" });

    expect(titles(rows)).toStrictEqual(["День золотої рибки", "Тиждень науки"]);
  });

  it("returns nothing for another teacher", async () => {
    const otherId = `test-${randomUUID()}`;
    await db.insert(user).values({
      id: otherId,
      name: "Another teacher",
      email: `${otherId}@example.test`,
      emailVerified: false,
    });

    try {
      expect(await getEventsInRange(otherId, WINDOW)).toStrictEqual([]);
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });
});

describe("listEvents()", () => {
  it("returns every event of the teacher, newest date first", async () => {
    const rows = await listEvents(userId);

    expect(rows.map((row) => row.title)).toStrictEqual([
      "Майбутній дедлайн",
      "Здати звіт",
      "Минулий дедлайн",
      "Тиждень науки",
      "Ярмарок",
      "День золотої рибки",
      "Осінній гурток",
    ]);
  });

  it("carries the boundary the teacher chose, symbol and date", async () => {
    const rows = await listEvents(userId);
    const club = rows.find((row) => row.title === "Осінній гурток");

    // Both halves: the form is put back with «до найближчих канікул» selected,
    // and the expansion runs on the resolved date (overview §8.1).
    expect(club?.boundaryKind).toBe("NEXT_BREAK");
    expect(club?.boundaryDate).toBe("2026-11-09");
  });

  it("returns nothing for another teacher", async () => {
    const otherId = `test-${randomUUID()}`;
    await db.insert(user).values({
      id: otherId,
      name: "Another teacher",
      email: `${otherId}@example.test`,
      emailVerified: false,
    });

    try {
      expect(await listEvents(otherId)).toStrictEqual([]);
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });
});

describe("getEvent()", () => {
  it("returns the one row by id", async () => {
    const [first] = await listEvents(userId);

    expect((await getEvent(userId, first.id))?.title).toBe(first.title);
  });

  it("returns null for another teacher's event", async () => {
    const [first] = await listEvents(userId);
    const otherId = `test-${randomUUID()}`;
    await db.insert(user).values({
      id: otherId,
      name: "Another teacher",
      email: `${otherId}@example.test`,
      emailVerified: false,
    });

    try {
      expect(await getEvent(otherId, first.id)).toBeNull();
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });
});
