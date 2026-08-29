import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/lib/db/client";
import { insertFixtureScenario } from "@/lib/db/fixtures/scenarioRows";
import { user } from "@/lib/db/schema";
import { createTestDatabase } from "@/lib/db/testDatabase";
import { expand } from "@/lib/domain/schedule/expand";
import {
  EXPECTED_CLASS,
  EXPECTED_OWN,
} from "@/lib/domain/schedule/fixtures/expected";
import { FIXTURE, WINDOW } from "@/lib/domain/schedule/fixtures/scenario";
import type { ScheduleInput } from "@/lib/domain/schedule/types";
import { getScheduleInput } from "./scheduleInput";

/**
 * What the read path assembles, against the fixture document — T-008's
 * acceptance criterion, and the reason the two transcriptions of
 * `docs/architecture/design/expand-fixtures.md` §3 are kept apart (§10).
 *
 * `lib/db/fixtures/scenarioRows.ts` wrote the rows; `FIXTURE` in
 * `lib/domain/schedule/fixtures/scenario.ts` is the same section transcribed
 * independently for the unit suite. This asserts that reading the first back
 * produces the second — so a typo in either transcription fails here, and the
 * document stays the thing both of them answer to.
 *
 * Needs a migrated database — `npm run test:integration`, not `npm test`.
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

/**
 * Both sides sorted the same way.
 *
 * Neither `expand()` nor anything downstream depends on the order of these
 * arrays — lessons come out sorted by `lessonNumber`, and the rules are read as
 * sets — so asserting the database's order would assert the query's `ORDER BY`
 * rather than its content.
 */
function normalize(input: ScheduleInput) {
  const by = (value: unknown) => JSON.stringify(value);
  const sorted = <T>(rows: readonly T[]) => [...rows].sort((a, b) => by(a).localeCompare(by(b)));

  return {
    anchors: sorted(input.anchors),
    nonTeachingPeriods: sorted(input.nonTeachingPeriods),
    weekdayRules: sorted(input.weekdayRules),
    bells: sorted(input.bells),
    overrides: sorted(input.overrides),
    templates: sorted(
      input.templates.map((version) => ({ ...version, slots: sorted(version.slots) })),
    ),
  };
}

beforeAll(async () => {
  userId = await createUser();
  await insertFixtureScenario(userId, db);
});

afterAll(async () => {
  // Everything the tests wrote cascades from the user rows.
  await db.delete(user).where(eq(user.id, userId));
  await close();
  // `getScheduleInput()` goes through `getDb()`, whose pool would otherwise
  // outlive the run.
  await closeDb();
});

describe("getScheduleInput()", () => {
  it("assembles exactly the input the fixture document states", async () => {
    const assembled = await getScheduleInput(userId, WINDOW);

    expect(normalize(assembled)).toStrictEqual(normalize(FIXTURE));
  });

  it("feeds expand() to the golden OWN days", async () => {
    const assembled = await getScheduleInput(userId, WINDOW);

    expect(expand(assembled, { ...WINDOW, view: "OWN" })).toStrictEqual(EXPECTED_OWN);
  });

  it("feeds expand() to the golden CLASS days", async () => {
    // The CLASS side is the one that proves both views are read whatever the
    // view asked for: `isTaughtByMe` is resolved against the OWN day, so a query
    // narrowed to CLASS would return `false` throughout (fixtures §8.6).
    const assembled = await getScheduleInput(userId, WINDOW);

    expect(expand(assembled, { ...WINDOW, view: "CLASS" })).toStrictEqual(EXPECTED_CLASS);
  });

  it("returns none of another teacher's rows", async () => {
    const otherId = await createUser();
    await insertFixtureScenario(otherId, db);

    try {
      const assembled = await getScheduleInput(userId, WINDOW);
      expect(normalize(assembled)).toStrictEqual(normalize(FIXTURE));
    } finally {
      await db.delete(user).where(eq(user.id, otherId));
    }
  });

  it("narrows every range read to the window asked for", async () => {
    // 2026-10-12 is a Monday inside OWN-V1 and CLASS-V1 and holds no override.
    const oneDay = { from: "2026-10-12", to: "2026-10-12" };

    const assembled = await getScheduleInput(userId, oneDay);

    expect(assembled.overrides).toStrictEqual([]);
    // Both views, and only the versions covering that day: V2 of either view
    // starts later. The order is the `schedule_view` enum's, OWN before CLASS.
    expect(
      assembled.templates.map((version) => [version.view, version.validFrom]),
    ).toStrictEqual([
      ["OWN", "2026-09-01"],
      ["CLASS", "2026-09-01"],
    ]);
    // The break of 2026-10-26 is outside the day; the holiday of 10-14 too.
    expect(assembled.nonTeachingPeriods).toStrictEqual([]);
    // The weekday rules in force on that date, all three of which span it.
    expect(assembled.weekdayRules).toHaveLength(3);
  });

  it("keeps the anchor in force before the window, which parity depends on", async () => {
    // A window in W45 is preceded by A1 (2026-09-01) and A2 (2026-11-04). An
    // overlap read would return neither, and `parityOn()` would throw or shift
    // the whole window (overview §3.5).
    const assembled = await getScheduleInput(userId, {
      from: "2026-11-09",
      to: "2026-11-13",
    });

    expect(assembled.anchors).toStrictEqual([
      { date: "2026-09-01", parity: "NUMERATOR" },
      { date: "2026-11-04", parity: "NUMERATOR" },
    ]);
  });

  it("falls back to the earliest anchor for a window before every anchor", async () => {
    // The teacher pages back to August, before the year's first anchor. There is
    // nothing in force, and `parityOn()` extends the earliest one backwards
    // rather than failing (`parity.ts`), so it has to receive it.
    const assembled = await getScheduleInput(userId, {
      from: "2026-08-24",
      to: "2026-08-30",
    });

    expect(assembled.anchors).toStrictEqual([
      { date: "2026-09-01", parity: "NUMERATOR" },
    ]);
  });
});
