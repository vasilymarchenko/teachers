import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { dayOverride, user } from "@/lib/db/schema";
import { createRecordingDatabase } from "@/lib/db/testDatabase";
import { getDayOverride, getDayOverrides } from "./overrides";

/**
 * Reading one `DayOverride` — T-011, against a real database.
 *
 * What is asserted here cannot be asserted anywhere else: that the three states
 * the override editor has to tell apart really do come back differently (no
 * row, a lesson-carrying row, a tombstone), that the payload is **parsed** on
 * the way out rather than cast (schema §7), and that another teacher's override
 * is invisible (overview §8.4). The recording client is used so the query runs
 * through `getDb()` exactly as the screen runs it.
 *
 * Needs a migrated database — `npm run test:integration`.
 */

const { db, restore } = createRecordingDatabase();

const DATE = "2026-10-19";

let userId: string;
let otherUserId: string;

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
  await db.delete(dayOverride).where(eq(dayOverride.userId, userId));
  await db.delete(dayOverride).where(eq(dayOverride.userId, otherUserId));
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
  await db.delete(user).where(eq(user.id, otherUserId));
  await restore();
});

describe("getDayOverride", () => {
  it("returns null where the weekly template alone applies", async () => {
    expect(await getDayOverride(userId, DATE, "OWN", 1)).toBeNull();
  });

  it("returns the row with its payload parsed (schema §7)", async () => {
    await db.insert(dayOverride).values({
      userId,
      date: DATE,
      view: "OWN",
      lessonNumber: 2,
      kind: "EDIT",
      payload: { subject: "Алгебра (контрольна)", className: "9-А" },
    });

    expect(await getDayOverride(userId, DATE, "OWN", 2)).toEqual({
      date: DATE,
      view: "OWN",
      lessonNumber: 2,
      kind: "EDIT",
      payload: { subject: "Алгебра (контрольна)", className: "9-А" },
    });
  });

  it("returns a tombstone with no payload key at all (fixtures §8.8)", async () => {
    // The state `expand()` cannot report: a `CLEARED` row over an empty slot
    // and no row at all resolve to the same empty day, and the editor has to
    // offer «Повернути урок» for one of them and not the other.
    await db.insert(dayOverride).values({
      userId,
      date: DATE,
      view: "CLASS",
      lessonNumber: 1,
      kind: "CLEARED",
    });

    const override = await getDayOverride(userId, DATE, "CLASS", 1);

    expect(override).toEqual({
      date: DATE,
      view: "CLASS",
      lessonNumber: 1,
      kind: "CLEARED",
    });
    expect(override !== null && "payload" in override).toBe(false);
  });

  it("distinguishes the slot by its view and its lesson number", async () => {
    // `day_override_slot_uq` is (`user_id`, `date`, `view`, `lesson_number`),
    // and the editor addresses exactly that: the `OWN` override of lesson 2 is
    // not the `CLASS` override of lesson 2 on the same date.
    await db.insert(dayOverride).values({
      userId,
      date: DATE,
      view: "OWN",
      lessonNumber: 2,
      kind: "EDIT",
      payload: { subject: "Алгебра", className: "9-А" },
    });

    expect(await getDayOverride(userId, DATE, "CLASS", 2)).toBeNull();
    expect(await getDayOverride(userId, DATE, "OWN", 3)).toBeNull();
    expect(await getDayOverride(userId, "2026-10-20", "OWN", 2)).toBeNull();
  });

  it("never returns another teacher's override", async () => {
    await db.insert(dayOverride).values({
      userId: otherUserId,
      date: DATE,
      view: "OWN",
      lessonNumber: 1,
      kind: "EDIT",
      payload: { subject: "Хімія", className: "8-А" },
    });

    expect(await getDayOverride(userId, DATE, "OWN", 1)).toBeNull();
    // The window read is the one the calendar makes; it must agree.
    expect(await getDayOverrides(userId, { from: DATE, to: DATE })).toEqual([]);
  });

  it("refuses a payload that does not match the view rather than dropping it", async () => {
    // A slot that silently vanished from the calendar would be a lesson the
    // teacher does not turn up to (`parseSlotPayload()`). `className` is not a
    // `CLASS` payload's field, so the row is an error and says which row.
    await db.insert(dayOverride).values({
      userId,
      date: DATE,
      view: "CLASS",
      lessonNumber: 4,
      kind: "EDIT",
      payload: { subject: "Алгебра", className: "9-А" },
    });

    await expect(getDayOverride(userId, DATE, "CLASS", 4)).rejects.toThrow(
      `day_override ${DATE} CLASS #4`,
    );
  });
});
