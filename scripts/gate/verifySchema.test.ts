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
  it("are blanked, because no driver understands them", () => {
    expect(stripPsqlMetaCommands("\\set ON_ERROR_STOP on\nSELECT 1;\n")).toBe(
      "\nSELECT 1;\n",
    );
  });

  it("are blanked rather than removed, so error positions still name the file", () => {
    expect(stripPsqlMetaCommands("  \\timing on\nSELECT 1;")).toBe("\nSELECT 1;");
  });

  it("do not take a backslash inside SQL with them", () => {
    // A backslash appears in ordinary SQL — an escaped string, a regex operator —
    // and blanking those lines would silently remove an assertion.
    const sql = "SELECT 'a\\nb' ~ '\\d+';";

    expect(stripPsqlMetaCommands(sql)).toBe(sql);
  });
});

describe("the file the gate and CI share", () => {
  const raw = readFileSync(VERIFY_SCHEMA_SQL, "utf8");

  it("carries its assertions in SQL a driver can send", () => {
    const stripped = stripPsqlMetaCommands(raw);

    expect(stripped).toContain("btree_gist");
    expect(stripped).toContain("EXCLUDE constraint");
    expect(stripped).toContain("DO $$");
  });

  it("uses no psql meta-command that carries an assertion", () => {
    // Asserted against the *raw* file. An earlier version filtered the
    // *stripped* text for the very lines the strip had just blanked, so it was
    // true by construction and could never fail — the guard the design document
    // promises, guarding nothing.
    const meta = raw
      .split("\n")
      .filter((line) => /^\s*\\/.test(line))
      .map((line) => line.trim());

    // `\set ON_ERROR_STOP on` may stay: it asserts nothing, and a driver raises
    // on the first error regardless, which is what that flag buys psql. A
    // `\gexec`, an `\if`, or an `\i` pulling in another file would each carry
    // meaning the gate silently drops while CI still runs it.
    expect(meta).toEqual(["\\set ON_ERROR_STOP on"]);
  });
});
