import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { stripPsqlMetaCommands, VERIFY_SCHEMA_SQL } from "./verifySchema";

/**
 * The gate runs the same `verify-schema.sql` CI runs, through a driver instead
 * of `psql`. That buys one file instead of two and costs one constraint: psql
 * meta-commands are not SQL, so anything the file asserts has to live in SQL
 * the driver can send.
 */

describe("psql meta-commands", () => {
  it("are dropped, because no driver understands them", () => {
    expect(stripPsqlMetaCommands("\\set ON_ERROR_STOP on\nSELECT 1;\n")).toBe(
      "\nSELECT 1;\n",
    );
  });

  it("are recognised through leading whitespace", () => {
    expect(stripPsqlMetaCommands("  \\timing on\nSELECT 1;")).toBe("\nSELECT 1;");
  });

  it("do not take a backslash inside SQL with them", () => {
    // A backslash appears in ordinary SQL — an escaped string, a regex operator —
    // and stripping those lines would silently remove an assertion.
    const sql = "SELECT 'a\\nb' ~ '\\d+';";

    expect(stripPsqlMetaCommands(sql)).toBe(sql);
  });
});

describe("the file the gate and CI share", () => {
  const stripped = stripPsqlMetaCommands(readFileSync(VERIFY_SCHEMA_SQL, "utf8"));

  it("still carries its assertions once the meta-commands are gone", () => {
    expect(stripped).toContain("btree_gist");
    expect(stripped).toContain("EXCLUDE constraint");
    expect(stripped).toContain("DO $$");
  });

  it("has nothing left in it that only psql could run", () => {
    // The check that keeps the two clients on one file: a meta-command added to
    // the SQL would pass in CI and vanish in the gate, taking whatever it
    // guarded with it.
    expect(stripped.split("\n").filter((line) => /^\s*\\/.test(line))).toEqual([]);
  });
});
