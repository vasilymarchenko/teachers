import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createRecordingDatabase } from "@/lib/db/testDatabase";
import { scheduleTemplate, templateSlot, user } from "@/lib/db/schema";
import {
  getNextTemplateVersionStart,
  getTemplateVersionInForce,
  listTemplateVersions,
} from "./templateEditor";

/**
 * The template editor's reads — T-010, against a real database.
 *
 * What is asserted here cannot be asserted anywhere else: that the version in
 * force on a date is the one the half-open interval covers, that a gap between
 * versions reads as «no version» rather than as the nearest one, and that
 * another teacher's rows are invisible (overview §8.4). The recording client is
 * used so that the queries run through `getDb()` exactly as the screen runs
 * them.
 *
 * Needs a migrated database — `npm run test:integration`.
 */

const { db, restore } = createRecordingDatabase();

let userId: string;
let otherUserId: string;

const version = (
  owner: string,
  view: "OWN" | "CLASS",
  validFrom: string,
  validTo: string,
) => ({
  userId: owner,
  view,
  validFrom,
  validTo,
  boundaryKind: "END_OF_SEMESTER" as const,
});

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
  otherUserId = await createUser();
});

afterEach(async () => {
  await db.delete(scheduleTemplate).where(eq(scheduleTemplate.userId, userId));
  await db
    .delete(scheduleTemplate)
    .where(eq(scheduleTemplate.userId, otherUserId));
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
  await db.delete(user).where(eq(user.id, otherUserId));
  await restore();
});

describe("getTemplateVersionInForce", () => {
  it("returns the version whose half-open interval covers the date", async () => {
    const [created] = await db
      .insert(scheduleTemplate)
      .values(version(userId, "OWN", "2027-09-01", "2027-12-25"))
      .returning();

    const inForce = await getTemplateVersionInForce(userId, "OWN", "2027-09-01");
    expect(inForce?.id).toBe(created.id);
    expect(inForce?.boundaryKind).toBe("END_OF_SEMESTER");

    // `valid_to` is exclusive (schema §6): the last day it covers is the one
    // before it, and the bound itself belongs to whatever comes next.
    expect(
      (await getTemplateVersionInForce(userId, "OWN", "2027-12-24"))?.id,
    ).toBe(created.id);
    expect(await getTemplateVersionInForce(userId, "OWN", "2027-12-25")).toBeNull();
  });

  it("returns null in a gap between versions, which is legal", async () => {
    // Overview §3.2: a hole is an empty calendar, not an error — so the editor
    // opens on an empty grid rather than on the previous version's slots.
    await db
      .insert(scheduleTemplate)
      .values([
        version(userId, "OWN", "2027-09-01", "2027-10-21"),
        version(userId, "OWN", "2027-11-02", "2027-12-25"),
      ]);

    expect(await getTemplateVersionInForce(userId, "OWN", "2027-10-26")).toBeNull();
  });

  it("does not mix the two views", async () => {
    await db
      .insert(scheduleTemplate)
      .values(version(userId, "CLASS", "2027-09-01", "2027-12-25"));

    expect(await getTemplateVersionInForce(userId, "OWN", "2027-09-15")).toBeNull();
    expect(
      (await getTemplateVersionInForce(userId, "CLASS", "2027-09-15"))?.view,
    ).toBe("CLASS");
  });

  it("reads the slots of that version and parses their payloads", async () => {
    const [created] = await db
      .insert(scheduleTemplate)
      .values(version(userId, "CLASS", "2027-09-01", "2027-12-25"))
      .returning();

    await db.insert(templateSlot).values({
      userId,
      templateId: created.id,
      weekday: "TUE",
      lessonNumber: 2,
      parity: "DENOMINATOR",
      payload: {
        subject: "Хімія",
        teacherName: "Іваненко І. І.",
        zoomLink: "https://zoom.us/j/1",
      },
    });

    const inForce = await getTemplateVersionInForce(userId, "CLASS", "2027-09-15");
    expect(inForce?.slots).toEqual([
      {
        weekday: "TUE",
        lessonNumber: 2,
        parity: "DENOMINATOR",
        payload: {
          subject: "Хімія",
          teacherName: "Іваненко І. І.",
          zoomLink: "https://zoom.us/j/1",
        },
      },
    ]);
  });

  it("does not see another teacher's version", async () => {
    await db
      .insert(scheduleTemplate)
      .values(version(otherUserId, "OWN", "2027-09-01", "2027-12-25"));

    expect(await getTemplateVersionInForce(userId, "OWN", "2027-09-15")).toBeNull();
  });
});

describe("getNextTemplateVersionStart", () => {
  it("finds the earliest version starting after the date", async () => {
    await db.insert(scheduleTemplate).values([
      version(userId, "OWN", "2027-09-01", "2027-10-21"),
      version(userId, "OWN", "2027-11-02", "2027-12-25"),
      version(userId, "OWN", "2028-01-11", "2028-03-01"),
    ]);

    expect(await getNextTemplateVersionStart(userId, "OWN", "2027-09-15")).toBe(
      "2027-11-02",
    );
  });

  it("does not count the version in force, which starts before the date", async () => {
    await db
      .insert(scheduleTemplate)
      .values(version(userId, "OWN", "2027-09-01", "2027-12-25"));

    expect(
      await getNextTemplateVersionStart(userId, "OWN", "2027-09-15"),
    ).toBeUndefined();
  });

  it("does not count the other view, or another teacher's", async () => {
    await db.insert(scheduleTemplate).values([
      version(userId, "CLASS", "2027-11-02", "2027-12-25"),
      version(otherUserId, "OWN", "2027-11-02", "2027-12-25"),
    ]);

    expect(
      await getNextTemplateVersionStart(userId, "OWN", "2027-09-15"),
    ).toBeUndefined();
  });
});

describe("listTemplateVersions", () => {
  it("lists one view's versions oldest first, and nobody else's", async () => {
    await db.insert(scheduleTemplate).values([
      version(userId, "OWN", "2027-11-02", "2027-12-25"),
      version(userId, "OWN", "2027-09-01", "2027-10-21"),
      version(userId, "CLASS", "2027-09-01", "2027-12-25"),
      version(otherUserId, "OWN", "2027-09-01", "2027-12-25"),
    ]);

    expect(
      (await listTemplateVersions(userId, "OWN")).map(
        (row) => row.validFrom,
      ),
    ).toEqual(["2027-09-01", "2027-11-02"]);
  });
});
