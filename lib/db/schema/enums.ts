import { pgEnum } from "drizzle-orm/pg-core";

/**
 * The eight PostgreSQL enum types of `docs/architecture/design/schema.md` §2.
 *
 * Every value is a term from `docs/architecture/glossary.md`; each set is closed
 * on purpose, so adding a value is a migration (`ALTER TYPE ... ADD VALUE`).
 *
 * They live in one file rather than beside the aggregate that uses them because
 * five of the eight are shared: `parity` by `parity_anchor` and `template_slot`,
 * `schedule_view` by `schedule_template` and `day_override`, `boundary_kind` by
 * three tables.
 */

export const parityEnum = pgEnum("parity", ["NUMERATOR", "DENOMINATOR"]);

export const scheduleViewEnum = pgEnum("schedule_view", ["OWN", "CLASS"]);

/**
 * `MON` … `SUN` correspond to ISO weekday numbers 1 … 7 (`date-fns` `getISODay`).
 * The name, not a `smallint`, so that no code has to reconcile ISO numbering
 * with JavaScript's `getDay()`; the mapping lives only in
 * `lib/domain/schedule/calendarRules.ts` (T-005).
 */
export const weekdayEnum = pgEnum("weekday", [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
]);

export const nonTeachingKindEnum = pgEnum("non_teaching_kind", [
  "BREAK",
  "PUBLIC_HOLIDAY",
  "OTHER",
]);

export const dayOverrideKindEnum = pgEnum("day_override_kind", [
  "EDIT",
  "SUBSTITUTION",
  "CLEARED",
]);

export const boundaryKindEnum = pgEnum("boundary_kind", [
  "DATE",
  "NEXT_BREAK",
  "END_OF_SEMESTER",
]);

export const eventKindEnum = pgEnum("event_kind", ["DEADLINE", "INFO"]);

export const recurrenceKindEnum = pgEnum("recurrence_kind", [
  "NONE",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);

export type Parity = (typeof parityEnum.enumValues)[number];
export type ScheduleView = (typeof scheduleViewEnum.enumValues)[number];
export type Weekday = (typeof weekdayEnum.enumValues)[number];
export type NonTeachingKind = (typeof nonTeachingKindEnum.enumValues)[number];
export type DayOverrideKind = (typeof dayOverrideKindEnum.enumValues)[number];
export type BoundaryKind = (typeof boundaryKindEnum.enumValues)[number];
export type EventKind = (typeof eventKindEnum.enumValues)[number];
export type RecurrenceKind = (typeof recurrenceKindEnum.enumValues)[number];
