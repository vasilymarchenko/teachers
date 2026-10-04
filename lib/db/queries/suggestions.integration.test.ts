import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  dayOverride,
  scheduleTemplate,
  templateSlot,
  user,
} from "@/lib/db/schema";
import type { ScheduleView } from "@/lib/db/schema/enums";
import { createRecordingDatabase } from "@/lib/db/testDatabase";
import { getLessonSuggestions } from "./suggestions";

/**
 * The suggestion lists of T-044, against a real database.
 *
 * What only a database can show: that both tables are read, across every
 * version and every date; that a slot's view is its parent version's; that a
 * `CLEARED` row contributes nothing; and that another teacher's values never
 * appear (overview §8.4). The ordering and the trimming rules themselves are
 * `lib/domain/schedule/suggestions.test.ts`; the index the reads use is
 * asserted with every other read in `indexUsage.integration.test.ts`.
 *
 * Needs a migrated database — `npm run test:integration`.
 */

const { db, restore } = createRecordingDatabase();

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

/** One template version with the given slot payloads, all on Mondays. */
async function version(
  owner: string,
  view: ScheduleView,
  validFrom: string,
  validTo: string,
  payloads: Record<string, string>[],
): Promise<void> {
  const [created] = await db
    .insert(scheduleTemplate)
    .values({ userId: owner, view, validFrom, validTo, boundaryKind: "DATE" })
    .returning({ id: scheduleTemplate.id });

  await db.insert(templateSlot).values(
    payloads.map((payload, index) => ({
      userId: owner,
      templateId: created.id,
      weekday: "MON" as const,
      lessonNumber: index + 1,
      parity: "NUMERATOR" as const,
      payload,
    })),
  );
}

beforeAll(async () => {
  userId = await createUser();
  otherUserId = await createUser();

  // Two OWN versions: the first one has ended, and its values still count.
  await version(userId, "OWN", "2025-09-01", "2026-01-01", [
    { subject: "Алгебра", className: "8-Б" },
    { subject: " Геометрія ", className: "8-А " },
  ]);
  await version(userId, "OWN", "2026-01-01", "2026-06-01", [
    { subject: "Алгебра", className: "8-А" },
    { subject: "математика", className: "10-А" },
    // An empty field is not a suggestion.
    { subject: "", className: "  " },
  ]);
  await version(userId, "CLASS", "2025-09-01", "2026-06-01", [
    { subject: "Історія", teacherName: "Коваль Н. П.", zoomLink: "", note: "" },
    // A stray `className` on a CLASS payload: the database does not enforce
    // the shape (schema §7), and the class names come from OWN only.
    {
      subject: "Біологія",
      teacherName: " Петренко О. І.",
      className: "Не клас",
      zoomLink: "",
      note: "",
    },
  ]);

  await db.insert(dayOverride).values([
    {
      userId,
      date: "2025-10-06",
      view: "OWN",
      lessonNumber: 3,
      kind: "EDIT",
      payload: { subject: "Математика", className: "8-В" },
    },
    {
      userId,
      date: "2026-05-18",
      view: "CLASS",
      lessonNumber: 2,
      kind: "SUBSTITUTION",
      payload: {
        subject: "Фізика",
        teacherName: "Петренко О. І.",
        zoomLink: "",
        note: "",
      },
    },
    { userId, date: "2026-05-19", view: "OWN", lessonNumber: 1, kind: "CLEARED" },
  ]);

  // Another teacher, with values the first one never typed.
  await version(otherUserId, "OWN", "2025-09-01", "2026-06-01", [
    { subject: "Хімія", className: "11-Б" },
  ]);
  await version(otherUserId, "CLASS", "2025-09-01", "2026-06-01", [
    { subject: "Хімія", teacherName: "Чужий В. В.", zoomLink: "", note: "" },
  ]);
  await db.insert(dayOverride).values({
    userId: otherUserId,
    date: "2025-10-06",
    view: "OWN",
    lessonNumber: 3,
    kind: "EDIT",
    payload: { subject: "Астрономія", className: "11-А" },
  });
});

afterAll(async () => {
  // Every row the suite wrote cascades from the two user rows.
  await db.delete(user).where(eq(user.id, userId));
  await db.delete(user).where(eq(user.id, otherUserId));
  await restore();
});

describe("getLessonSuggestions", () => {
  it("reads both tables across every version and date, trimmed, deduplicated and sorted", async () => {
    expect(await getLessonSuggestions(userId)).toEqual({
      // Both views, both tables. «Математика» and «математика» are both kept,
      // the lower case first as CLDR's root collation orders a tie broken only
      // by case; the Ukrainian order puts «Історія» after «Геометрія», not
      // before «Алгебра» as its code point would.
      subjects: [
        "Алгебра",
        "Біологія",
        "Геометрія",
        "Історія",
        "математика",
        "Математика",
        "Фізика",
      ],
      // OWN only — slots of both versions and the EDIT override.
      classNames: ["8-А", "8-Б", "8-В", "10-А"],
      // CLASS only — the slot and the SUBSTITUTION override name the same
      // teacher once the slot's leading space is trimmed.
      teacherNames: ["Коваль Н. П.", "Петренко О. І."],
    });
  });

  it("never returns another teacher's values", async () => {
    const suggestions = await getLessonSuggestions(userId);
    const every = [
      ...suggestions.subjects,
      ...suggestions.classNames,
      ...suggestions.teacherNames,
    ];

    for (const foreign of ["Хімія", "Астрономія", "11-А", "11-Б", "Чужий В. В."]) {
      expect(every).not.toContain(foreign);
    }
  });

  it("returns three empty lists for a teacher with nothing entered", async () => {
    const fresh = await createUser();
    try {
      expect(await getLessonSuggestions(fresh)).toEqual({
        subjects: [],
        classNames: [],
        teacherNames: [],
      });
    } finally {
      await db.delete(user).where(eq(user.id, fresh));
    }
  });
});
