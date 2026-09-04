import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "@/lib/db/testDatabase";
import { scheduleTemplate, templateSlot, user } from "@/lib/db/schema";

/**
 * What the database itself guarantees about `schedule_template` — invariant I3
 * of `architect-overview.md` §3.2, as specified in
 * `docs/architecture/design/schema.md` §4.7.
 *
 * These assertions cannot be made against a mock: the exclusion constraint, the
 * range check and the composite foreign key exist only in SQL, and the point of
 * the ticket is that they are actually in the migration.
 *
 * Needs a migrated database — `npm run test:integration`, not `npm test`.
 */

const { db, close } = createTestDatabase();

/** A `user` row of our own, so the suite never touches the seeded teacher. */
let userId: string;

const version = (
  view: "OWN" | "CLASS",
  validFrom: string,
  validTo: string,
) => ({ userId, view, validFrom, validTo, boundaryKind: "DATE" as const });

/**
 * The name of the constraint that rejected a write.
 *
 * Drizzle wraps a driver error in one whose message is the failed SQL, so
 * matching on the message would assert the query rather than the constraint.
 * The `postgres` error, with `constraint_name` on it, is the `cause`.
 */
async function rejectedBy(write: Promise<unknown>): Promise<string> {
  try {
    await write;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    return cause?.constraint_name ?? `no constraint name on: ${String(error)}`;
  }
  throw new Error("expected the write to be rejected, but it succeeded");
}

beforeAll(async () => {
  userId = `test-${randomUUID()}`;
  await db.insert(user).values({
    id: userId,
    name: "Integration test",
    email: `${userId}@example.test`,
    emailVerified: false,
  });
});

// Each test owns its rows; the versions of one must not narrow what the next
// can insert.
afterEach(async () => {
  await db.delete(scheduleTemplate).where(eq(scheduleTemplate.userId, userId));
});

afterAll(async () => {
  // Everything the tests wrote cascades from the user row.
  await db.delete(user).where(eq(user.id, userId));
  await close();
});

describe("schedule_template versions may not overlap", () => {
  it("rejects two versions of the same (user, view) whose ranges overlap", async () => {
    await db.insert(scheduleTemplate).values(version("OWN", "2026-09-01", "2026-10-21"));

    expect(
      await rejectedBy(
        db.insert(scheduleTemplate).values(version("OWN", "2026-10-20", "2026-12-25")),
      ),
    ).toBe("schedule_template_no_overlap_ex");
  });

  it("accepts the same two ranges when the view differs", async () => {
    // The exclusion constraint compares `view` with `=`, so an OWN version and a
    // CLASS version are free to cover the same days — which is the normal shape:
    // the teacher's own lessons and their class's run in parallel.
    await db.insert(scheduleTemplate).values([
      version("OWN", "2027-01-12", "2027-03-01"),
      version("CLASS", "2027-01-12", "2027-03-01"),
    ]);

    const rows = await db
      .select()
      .from(scheduleTemplate)
      .where(
        and(
          eq(scheduleTemplate.userId, userId),
          eq(scheduleTemplate.validFrom, "2027-01-12"),
        ),
      );
    expect(rows).toHaveLength(2);
  });

  it("accepts a gap between two consecutive versions", async () => {
    // Overview §3.2: holes are legal, and the fixture depends on it — the CLASS
    // gap [2026-10-21, 2026-11-02) renders as an empty calendar, not an error.
    await db.insert(scheduleTemplate).values([
      version("CLASS", "2027-03-08", "2027-03-15"),
      version("CLASS", "2027-03-22", "2027-04-01"),
    ]);

    const rows = await db
      .select()
      .from(scheduleTemplate)
      .where(
        and(
          eq(scheduleTemplate.userId, userId),
          eq(scheduleTemplate.view, "CLASS"),
          eq(scheduleTemplate.validFrom, "2027-03-08"),
        ),
      );
    expect(rows).toHaveLength(1);
  });

  it("rejects a zero-length version, which is what makes the exclusion sound", async () => {
    // `daterange(d, d)` is the empty range and overlaps nothing, so without
    // `schedule_template_range_ck` any number of zero-length versions would slip
    // past the constraint above.
    expect(
      await rejectedBy(
        db.insert(scheduleTemplate).values(version("OWN", "2027-05-04", "2027-05-04")),
      ),
    ).toBe("schedule_template_range_ck");
  });
});

describe("a second template edit on the same day", () => {
  // `docs/architecture/design/schema.md` §4.7. The first edit of a day cuts the
  // version in force at `today()` and inserts a new one. A second edit the same
  // day cannot cut again — the version in force now starts today, so the cut
  // would give it zero length — so it updates that version's slots in place.
  const today = "2027-04-12";

  it("cannot be done by cutting: the cut would make the version zero-length", async () => {
    const [created] = await db
      .insert(scheduleTemplate)
      .values(version("OWN", today, "2027-06-01"))
      .returning();

    expect(
      await rejectedBy(
        db
          .update(scheduleTemplate)
          .set({ validTo: today })
          .where(eq(scheduleTemplate.id, created.id)),
      ),
    ).toBe("schedule_template_range_ck");
  });

  it("updates the version in force in place, leaving one version and no hole", async () => {
    const [created] = await db
      .insert(scheduleTemplate)
      .values(version("OWN", today, "2027-06-01"))
      .returning();

    const [slot] = await db
      .insert(templateSlot)
      .values({
        userId,
        templateId: created.id,
        weekday: "MON",
        lessonNumber: 1,
        parity: "NUMERATOR",
        payload: { subject: "Математика", className: "7-А" },
      })
      .returning();

    // The in-place path: same version, edited slots.
    await db
      .update(templateSlot)
      .set({ payload: { subject: "Алгебра", className: "9-А" } })
      .where(eq(templateSlot.id, slot.id));

    const versions = await db
      .select()
      .from(scheduleTemplate)
      .where(
        and(
          eq(scheduleTemplate.userId, userId),
          eq(scheduleTemplate.view, "OWN"),
          eq(scheduleTemplate.validFrom, today),
        ),
      );
    expect(versions).toHaveLength(1);
    expect(versions[0].validFrom).toBe(today);
    expect(versions[0].validTo).toBe("2027-06-01");

    const slots = await db
      .select()
      .from(templateSlot)
      .where(eq(templateSlot.templateId, created.id));
    expect(slots).toHaveLength(1);
    expect(slots[0].payload).toEqual({ subject: "Алгебра", className: "9-А" });
  });
});

describe("updated_at", () => {
  it("moves on an update, because Drizzle sets it — the SQL default only covers INSERT", async () => {
    const [created] = await db
      .insert(scheduleTemplate)
      .values(version("OWN", "2027-04-19", "2027-05-03"))
      .returning();
    expect(created.updatedAt).toEqual(created.createdAt);

    const [updated] = await db
      .update(scheduleTemplate)
      .set({ validTo: "2027-05-10" })
      .where(eq(scheduleTemplate.id, created.id))
      .returning();

    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect(updated.createdAt).toEqual(created.createdAt);
  });
});

describe("a slot cannot be attached to another user's template", () => {
  it("rejects a template_id that does not belong to the slot's user", async () => {
    const otherUserId = `test-${randomUUID()}`;
    await db.insert(user).values({
      id: otherUserId,
      name: "Another teacher",
      email: `${otherUserId}@example.test`,
      emailVerified: false,
    });

    const [theirs] = await db
      .insert(scheduleTemplate)
      .values({
        userId: otherUserId,
        view: "OWN",
        validFrom: "2027-04-26",
        validTo: "2027-05-03",
        boundaryKind: "DATE",
      })
      .returning();

    // The composite FK is what stops the denormalised `user_id` on a child from
    // being a lie (schema §8).
    expect(
      await rejectedBy(
        db.insert(templateSlot).values({
          userId,
          templateId: theirs.id,
          weekday: "MON",
          lessonNumber: 1,
          parity: "NUMERATOR",
          payload: { subject: "Математика", className: "7-А" },
        }),
      ),
    ).toBe("template_slot_template_fk");

    await db.delete(user).where(eq(user.id, otherUserId));
  });
});

describe("two teachers' windows saving the same view at once", () => {
  /**
   * The concurrent-save case T-010 requires a test for.
   *
   * Both windows planned their edit against the same version in force, so both
   * do the copy-on-write of overview §3.2 — trim that version at the cut, then
   * insert a new one covering the rest. Nothing in the application can tell
   * them apart: each read a live version and each is writing a legal pair of
   * statements. `schedule_template_no_overlap_ex` (I3) is what decides, and it
   * is the reason the constraint is in the schema rather than in a check the
   * action performs before writing — a check would let both pass and then let
   * both insert.
   *
   * The loser's message is `VERSION_CHANGED` in
   * `lib/actions/scheduleTemplate.ts`, mapped from this constraint name.
   */
  const cut = "2027-02-15";

  const copyOnWrite = (
    database: typeof db,
    versionId: string,
  ): Promise<unknown> =>
    database.transaction(async (tx) => {
      await tx
        .update(scheduleTemplate)
        .set({ validTo: cut })
        .where(eq(scheduleTemplate.id, versionId));

      await tx
        .insert(scheduleTemplate)
        .values(version("OWN", cut, "2027-06-01"));
    });

  it("lets one through and refuses the other by the exclusion constraint", async () => {
    const [inForce] = await db
      .insert(scheduleTemplate)
      .values(version("OWN", "2027-01-11", "2027-06-01"))
      .returning();

    // Two connections, because two transactions on one connection are not
    // concurrent — the second would simply run after the first.
    const other = createTestDatabase();
    try {
      const results = await Promise.allSettled([
        copyOnWrite(db, inForce.id),
        copyOnWrite(other.db, inForce.id),
      ]);

      const rejected = results.filter((result) => result.status === "rejected");
      expect(rejected).toHaveLength(1);
      expect(
        ((rejected[0] as PromiseRejectedResult).reason as {
          cause?: { constraint_name?: string };
        }).cause?.constraint_name,
      ).toBe("schedule_template_no_overlap_ex");
    } finally {
      await other.close();
    }

    // The winner's write is whole: the old version is trimmed and exactly one
    // version covers the days after the cut.
    const rows = await db
      .select()
      .from(scheduleTemplate)
      .where(
        and(eq(scheduleTemplate.userId, userId), eq(scheduleTemplate.view, "OWN")),
      );

    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.validFrom === cut)).toHaveLength(1);
    expect(rows.find((row) => row.validFrom === "2027-01-11")?.validTo).toBe(cut);
  });
});
