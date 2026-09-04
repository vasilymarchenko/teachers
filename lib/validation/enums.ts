/**
 * The enum values the forms and their schemas work with, as plain tuples.
 *
 * They are transcribed from `lib/db/schema/enums.ts` rather than imported from
 * it, and `enums.test.ts` asserts every tuple equals the `pgEnum` it mirrors —
 * so a value added to the database in a migration fails the suite until it is
 * added here too.
 *
 * The reason for the transcription is the client bundle: these modules are
 * imported by the form components, and importing the Drizzle schema would drag
 * `drizzle-orm/pg-core` into the browser to read four string arrays. The
 * schema's *types* are still imported (type-only, erased at build), so a tuple
 * that drifts fails the type check as well as the test.
 */
import type {
  BoundaryKind,
  NonTeachingKind,
  Parity,
  ScheduleView,
  Weekday,
} from "@/lib/db/schema/enums";

export const PARITY_VALUES = ["NUMERATOR", "DENOMINATOR"] as const satisfies
  readonly Parity[];

export const WEEKDAY_VALUES = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const satisfies readonly Weekday[];

export const SCHEDULE_VIEW_VALUES = ["OWN", "CLASS"] as const satisfies
  readonly ScheduleView[];

export const NON_TEACHING_KIND_VALUES = [
  "BREAK",
  "PUBLIC_HOLIDAY",
  "OTHER",
] as const satisfies readonly NonTeachingKind[];

export const BOUNDARY_KIND_VALUES = [
  "DATE",
  "NEXT_BREAK",
  "END_OF_SEMESTER",
] as const satisfies readonly BoundaryKind[];

/** The lesson numbers a `BellSchedule` may cover — specification §3.3. */
export const LESSON_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** The two semester numbers of specification §3.2; `semester.index` in the schema. */
export const SEMESTER_INDEXES = [1, 2] as const;
