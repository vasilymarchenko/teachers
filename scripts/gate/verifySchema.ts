/**
 * Runs `scripts/verify-schema.sql` against a database.
 *
 * The same file CI runs, not a transcription of it — the assertions live in one
 * place, and a check that copied them would be the thing ADR-001 forbids one
 * layer down. What differs is the client: CI has `psql`, a Windows developer
 * machine generally does not, and `postgres` is already a dependency.
 *
 * The consequence is a constraint on the SQL file: psql meta-commands (`\set`,
 * `\i`, `\gexec`) are not SQL and no driver understands them. The file's
 * `\set ON_ERROR_STOP on` is stripped here, which costs nothing — a driver
 * raises on the first error regardless, which is exactly what the flag buys
 * psql. Anything beyond that belongs in the `DO $$` block, where both clients
 * read it the same way.
 */

import { readFileSync } from "node:fs";

import postgres from "postgres";

export const VERIFY_SCHEMA_SQL = "scripts/verify-schema.sql";

/**
 * Blanks psql meta-commands — lines whose first non-space character is a
 * backslash.
 *
 * Blanked rather than removed: Postgres reports an error by position, and a
 * dropped line shifts every line under it, so the driver would point at the
 * wrong line of a file the developer then opens.
 */
export function stripPsqlMetaCommands(sql: string): string {
  return sql
    .split("\n")
    .map((line) => (/^\s*\\/.test(line) ? "" : line))
    .join("\n");
}

export async function verifySchema(databaseUrl: string): Promise<void> {
  const sql = stripPsqlMetaCommands(readFileSync(VERIFY_SCHEMA_SQL, "utf8"));
  // `max: 1` and no prepared statements: this is one multi-statement script run
  // once, and `.unsafe()` is the only way to send it as the file wrote it.
  const client = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await client.unsafe(sql);
  } finally {
    await client.end({ timeout: 5 });
  }
}
