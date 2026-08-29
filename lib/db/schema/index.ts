/**
 * The schema barrel — everything `getDb()` registers and every query imports.
 *
 * The tables are transcribed from `docs/architecture/design/schema.md`, one file
 * per aggregate; that document is authoritative, not this code. Two things it
 * specifies cannot be expressed in Drizzle and live in hand-written migrations
 * instead: `CREATE EXTENSION btree_gist` (`drizzle/0000_btree_gist.sql`) and the
 * three `EXCLUDE USING gist` constraints
 * (`drizzle/0002_exclusion_constraints.sql`).
 */

export * from "./auth";
export * from "./enums";
export * from "./academicYear";
export * from "./nonTeachingWeekdayRule";
export * from "./bellSchedule";
export * from "./parityAnchor";
export * from "./scheduleTemplate";
export * from "./dayOverride";
export * from "./event";
