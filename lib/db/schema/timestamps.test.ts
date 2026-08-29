import { getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";

/**
 * `updated_at` is maintained by the application, not by a database trigger
 * (`docs/architecture/design/schema.md` §1). The SQL default fires on `INSERT`
 * only, so a table that declares the column without `.$onUpdate()` would report
 * its insert time forever — and nothing would fail to tell anyone.
 *
 * This is the structural half of that guarantee: every table that has the column
 * has the hook. The behavioural half — that the hook actually moves the value —
 * is in `scheduleTemplate.integration.test.ts`.
 */

const tablesWithUpdatedAt = Object.entries(schema).flatMap(([name, value]) => {
  if (!is(value, PgTable)) return [];
  const columns = getTableColumns(value) as Record<string, unknown>;
  return "updatedAt" in columns ? [[name, columns] as const] : [];
});

describe("updated_at", () => {
  it("is declared by every table the teacher edits", () => {
    // Ten profile tables plus better-auth's four. A new aggregate that forgets
    // the `timestamps()` helper shows up here as a smaller number.
    expect(tablesWithUpdatedAt.map(([name]) => name).sort()).toEqual([
      "academicYear",
      "account",
      "bellSchedule",
      "dayOverride",
      "event",
      "nonTeachingPeriod",
      "nonTeachingWeekdayRule",
      "parityAnchor",
      "scheduleTemplate",
      "semester",
      "session",
      "templateSlot",
      "user",
      "verification",
    ]);
  });

  it.each(tablesWithUpdatedAt)("is refreshed on update by %s", (_name, columns) => {
    const updatedAt = columns.updatedAt as { onUpdateFn?: () => unknown };
    expect(typeof updatedAt.onUpdateFn).toBe("function");
  });
});
