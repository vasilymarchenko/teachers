/**
 * Seeds the fixture scenario of `docs/architecture/design/expand-fixtures.md` §3.
 *
 * That document is the single source for the scenario: this script transcribes
 * it, and T-005's test expectations transcribe it, and neither restates it
 * independently. **A value here that does not appear in the fixture is a bug
 * here.** Section references below point at the rows each block came from.
 *
 * Run after `drizzle-kit migrate` has applied the whole set, never against a
 * partially migrated database: several properties of the fixture are proved by
 * constraints rather than by assertions in this script
 * (`docs/architecture/design/schema.md` §9.1).
 *
 * The intervals of §3.6 are inserted at their final values. §3.8 gives the write
 * timeline that produced them; replaying it would additionally exercise
 * copy-on-write, which is not what this seed is for (fixtures §10).
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import {
  academicYear,
  bellSchedule,
  dayOverride,
  nonTeachingPeriod,
  nonTeachingWeekdayRule,
  parityAnchor,
  scheduleTemplate,
  semester,
  templateSlot,
  user,
} from "@/lib/db/schema";
import type { Parity, ScheduleView, Weekday } from "@/lib/db/schema/enums";
import { slotPayloadFor } from "@/lib/validation/slotPayload";

config({ path: ".env", quiet: true });

// It deletes data. The guard is the difference between a demo reset and an
// accident on the VPS (T-015).
if (process.env.NODE_ENV === "production" && !process.env.SEED_ALLOW_PRODUCTION) {
  throw new Error(
    "Refusing to seed with NODE_ENV=production. Set SEED_ALLOW_PRODUCTION=1 to override.",
  );
}

const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL ?? "demo@teachers.local";
const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD ?? "demo-password-1";
const SEED_USER_NAME = "Ковальчук М. І.";

/**
 * A `template_slot` cell: the two parities of one `(weekday, lessonNumber)`.
 *
 * The payloads are `unknown` on purpose — they are transcribed fixture rows, and
 * `parsePayload` below is what makes them a payload. Typing them as the payload
 * type would let a wrong transcription typecheck.
 */
type Cell = [
  weekday: Weekday,
  lessonNumber: number,
  numerator: unknown,
  denominator: unknown,
];

const own = (subject: string, className: string) => ({ subject, className });
const cls = (
  subject: string,
  teacherName: string,
  zoomLink: string,
  note?: string,
) => (note === undefined
  ? { subject, teacherName, zoomLink }
  : { subject, teacherName, zoomLink, note });

/** Fixtures §3.6, `TemplateSlot` — OWN-V1. */
const OWN_V1_CELLS: Cell[] = [
  ["MON", 1, own("Математика", "7-А"), own("Математика", "7-А")],
  ["MON", 2, own("Алгебра", "9-А"), null],
  ["TUE", 2, own("Геометрія", "9-А"), own("Геометрія", "9-А")],
  ["WED", 1, own("Математика", "7-А"), own("Математика", "7-А")],
  ["WED", 3, own("Інформатика", "7-А"), own("Алгебра", "9-А")],
  ["THU", 2, own("Математика", "6-Б"), own("Математика", "6-Б")],
  ["FRI", 1, own("Математика", "6-Б"), own("Математика", "6-Б")],
];

/** Fixtures §3.6, `TemplateSlot` — OWN-V2. */
const OWN_V2_CELLS: Cell[] = [
  ["MON", 1, own("Математика", "7-А"), own("Математика", "7-А")],
  ["MON", 2, own("Алгебра", "9-А"), own("Алгебра", "9-А")],
  ["TUE", 2, own("Геометрія", "9-А"), null],
  ["WED", 1, own("Математика", "7-А"), own("Математика", "7-А")],
  ["WED", 3, own("Інформатика", "7-А"), own("Інформатика", "7-А")],
  ["THU", 2, own("Математика", "5-В"), own("Алгебра", "9-А")],
  ["FRI", 1, own("Математика", "5-В"), own("Геометрія", "9-А")],
];

const MATH_7A = cls("Математика", "Ковальчук М. І.", "https://zoom.us/j/7a-math");
const UKR_7A = cls("Українська мова", "Шевченко О. П.", "https://zoom.us/j/7a-ukr");

/** Fixtures §3.6, `TemplateSlot` — CLASS-V1, class 7-А. */
const CLASS_V1_CELLS: Cell[] = [
  ["MON", 1, MATH_7A, MATH_7A],
  ["MON", 2, UKR_7A, UKR_7A],
  ["WED", 1, MATH_7A, MATH_7A],
  [
    "WED",
    3,
    cls("Інформатика", "Ковальчук М. І.", "https://zoom.us/j/7a-it", "кабінет 12"),
    cls("Історія", "Бондар І. С.", "https://zoom.us/j/7a-hist"),
  ],
];

/** Fixtures §3.6, `TemplateSlot` — CLASS-V2, class 7-А. */
const CLASS_V2_CELLS: Cell[] = [
  ["MON", 1, MATH_7A, MATH_7A],
  ["MON", 2, UKR_7A, UKR_7A],
  ["WED", 1, MATH_7A, MATH_7A],
  [
    "WED",
    3,
    cls("Інформатика", "Ковальчук М. І.", "https://zoom.us/j/7a-it"),
    cls("Інформатика", "Ковальчук М. І.", "https://zoom.us/j/7a-it"),
  ],
  [
    "FRI",
    2,
    cls("Фізика", "Ткаченко Л. В.", "https://zoom.us/j/7a-phys"),
    cls("Фізика", "Ткаченко Л. В.", "https://zoom.us/j/7a-phys"),
  ],
];

async function main() {
  const db = getDb();

  // Idempotency: the demo user's rows go with the user, through
  // `ON DELETE CASCADE` (schema §10). Running the seed twice leaves the same
  // database.
  //
  // This delete and the sign-up below are outside the transaction that follows,
  // because better-auth's API owns its own connection and cannot join one. A
  // failure partway leaves a half-seeded user, which the next run clears —
  // idempotency rather than atomicity, as schema §10 records.
  await db.delete(user).where(eq(user.email, SEED_USER_EMAIL));

  // Through better-auth's own API rather than an INSERT into its tables, so the
  // password hash is what better-auth expects (schema §10).
  const signUp = await getAuth().api.signUpEmail({
    body: {
      email: SEED_USER_EMAIL,
      password: SEED_USER_PASSWORD,
      name: SEED_USER_NAME,
    },
  });
  const userId = signUp.user.id;

  await db.transaction(async (tx) => {
    // Fixtures §3.1 — AcademicYear Y1 and its two semesters. Y1's "initial
    // parity NUMERATOR" is anchor A1 below and nothing else: `academic_year`
    // has no parity column (schema §4.1, finding F-1).
    const [y1] = await tx
      .insert(academicYear)
      .values({ userId, dateFrom: "2026-09-01", dateTo: "2027-05-31" })
      .returning();

    await tx.insert(semester).values([
      { userId, academicYearId: y1.id, index: 1, dateFrom: "2026-09-01", dateTo: "2026-12-24" },
      { userId, academicYearId: y1.id, index: 2, dateFrom: "2027-01-12", dateTo: "2027-05-31" },
    ]);

    // Fixtures §3.2 — P1 the one-day holiday, P2 the full break week.
    await tx.insert(nonTeachingPeriod).values([
      {
        userId,
        academicYearId: y1.id,
        kind: "PUBLIC_HOLIDAY",
        name: "День захисників і захисниць України",
        dateFrom: "2026-10-14",
        dateTo: "2026-10-14",
      },
      {
        userId,
        academicYearId: y1.id,
        kind: "BREAK",
        name: "Осінні канікули",
        dateFrom: "2026-10-26",
        dateTo: "2026-11-01",
      },
    ]);

    // Fixtures §3.3 — R1 the methodical day, R2/R3 the weekend. `validFrom` is
    // the year's `dateFrom` and not `today()`: these are part of the year frame
    // (schema §4.4), and a rule dated today would make every Friday before it a
    // teaching day.
    await tx.insert(nonTeachingWeekdayRule).values([
      { userId, weekday: "FRI", validFrom: "2026-09-01", boundaryDate: "2026-10-26", boundaryKind: "NEXT_BREAK" },
      { userId, weekday: "SAT", validFrom: "2026-09-01", boundaryDate: "2027-06-01", boundaryKind: "DATE" },
      { userId, weekday: "SUN", validFrom: "2026-09-01", boundaryDate: "2027-06-01", boundaryKind: "DATE" },
    ]);

    // Fixtures §3.4 — only the lesson numbers in use have rows.
    await tx.insert(bellSchedule).values([
      { userId, lessonNumber: 1, timeFrom: "08:30", timeTo: "09:15" },
      { userId, lessonNumber: 2, timeFrom: "09:25", timeTo: "10:10" },
      { userId, lessonNumber: 3, timeFrom: "10:25", timeTo: "11:10" },
      { userId, lessonNumber: 4, timeFrom: "11:20", timeTo: "12:05" },
      { userId, lessonNumber: 5, timeFrom: "12:15", timeTo: "13:00" },
    ]);

    // Fixtures §3.5 — A1 the year's initial value, A2 the mid-week reset.
    await tx.insert(parityAnchor).values([
      { userId, date: "2026-09-01", parity: "NUMERATOR" },
      { userId, date: "2026-11-04", parity: "NUMERATOR" },
    ]);

    // Fixtures §3.6 — four versions. The two OWN versions abut; the two CLASS
    // versions leave the gap [2026-10-21, 2026-11-02) on purpose.
    //
    // `boundaryKind` on OWN-V1 is DATE: §3.8 shows it entered as
    // END_OF_SEMESTER and then cut to 2026-10-21 by copy-on-write, and a cut
    // date was not entered by the teacher at all. The other three are the
    // values §3.8 states.
    const versions = [
      { key: "OWN-V1", view: "OWN" as const, validFrom: "2026-09-01", validTo: "2026-10-21", boundaryKind: "DATE" as const, cells: OWN_V1_CELLS },
      { key: "OWN-V2", view: "OWN" as const, validFrom: "2026-10-21", validTo: "2026-12-25", boundaryKind: "END_OF_SEMESTER" as const, cells: OWN_V2_CELLS },
      { key: "CLASS-V1", view: "CLASS" as const, validFrom: "2026-09-01", validTo: "2026-10-21", boundaryKind: "DATE" as const, cells: CLASS_V1_CELLS },
      { key: "CLASS-V2", view: "CLASS" as const, validFrom: "2026-11-02", validTo: "2026-12-25", boundaryKind: "END_OF_SEMESTER" as const, cells: CLASS_V2_CELLS },
    ];

    for (const version of versions) {
      const [row] = await tx
        .insert(scheduleTemplate)
        .values({
          userId,
          view: version.view,
          validFrom: version.validFrom,
          validTo: version.validTo,
          boundaryKind: version.boundaryKind,
        })
        .returning();

      const slots = version.cells.flatMap(([weekday, lessonNumber, numerator, denominator]) =>
        ([["NUMERATOR", numerator], ["DENOMINATOR", denominator]] as [Parity, Record<string, string> | null][])
          // A slot exists only when the cell is filled: `—` in the fixture
          // tables means no row, not a row with an empty payload (schema §4.8).
          .filter(([, payload]) => payload !== null)
          .map(([parity, payload]) => ({
            userId,
            templateId: row.id,
            weekday,
            lessonNumber,
            parity,
            payload: parsePayload(version.view, payload, `${version.key} ${weekday}/${lessonNumber}`),
          })),
      );

      await tx.insert(templateSlot).values(slots);
    }

    // Fixtures §3.7 — O1 … O8. A CLEARED override is a tombstone: the row
    // exists and `payload` is NULL (schema §4.9).
    await tx.insert(dayOverride).values([
      { userId, date: "2026-10-13", lessonNumber: 2, view: "OWN", kind: "EDIT", payload: parsePayload("OWN", own("Алгебра (контрольна)", "9-А"), "O1") },
      { userId, date: "2026-10-19", lessonNumber: 1, view: "OWN", kind: "CLEARED", payload: null },
      { userId, date: "2026-11-05", lessonNumber: 2, view: "OWN", kind: "SUBSTITUTION", payload: parsePayload("OWN", own("Фізика", "8-А"), "O3") },
      { userId, date: "2026-10-22", lessonNumber: 1, view: "CLASS", kind: "EDIT", payload: parsePayload("CLASS", { subject: "Виховна година", teacherName: "Шевченко О. П.", note: "замість уроків" }, "O4") },
      { userId, date: "2026-11-09", lessonNumber: 2, view: "CLASS", kind: "CLEARED", payload: null },
      { userId, date: "2026-10-17", lessonNumber: 3, view: "OWN", kind: "EDIT", payload: parsePayload("OWN", own("Відпрацювання", "7-А"), "O6") },
      { userId, date: "2026-11-10", lessonNumber: 2, view: "OWN", kind: "SUBSTITUTION", payload: parsePayload("OWN", own("Хімія", "8-А"), "O7") },
      { userId, date: "2026-11-12", lessonNumber: 3, view: "CLASS", kind: "CLEARED", payload: null },
    ]);
  });

  console.log(`Seeded the fixture scenario for ${SEED_USER_EMAIL} (user ${userId}).`);
}

/**
 * Every payload goes through `lib/validation/slotPayload.ts` on the way in, like
 * every Server Action will (schema §7) — so a fixture row that does not match
 * the schema fails the seed instead of reaching the database.
 */
function parsePayload(view: ScheduleView, payload: unknown, where: string) {
  const parsed = slotPayloadFor(view).safeParse(payload);
  if (!parsed.success) {
    throw new Error(`${where}: payload does not match the ${view} schema — ${parsed.error.message}`);
  }
  return parsed.data;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
