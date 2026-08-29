import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * A dedicated connection for the integration suite.
 *
 * Not `getDb()`: that one caches on `globalThis` and is never closed, which
 * leaves Vitest hanging on an open pool at the end of a run. This opens one
 * connection, hands back a `close()`, and is used nowhere but in tests.
 */
export function createTestDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — the integration suite needs a migrated Postgres. " +
        "Copy .env.example to .env, run `docker compose up -d`, then `npm run db:migrate`.",
    );
  }
  const client = postgres(url, { max: 1 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

/**
 * A test database that also records the SQL the application sends, installed as
 * the client `getDb()` hands out.
 *
 * The index-usage test has to `EXPLAIN` **the queries the query modules
 * actually run**, not a transcription of them into the test — a transcription
 * proves an index exists for SQL nobody executes. Drizzle's logger reports each
 * statement with its parameters, which is exactly what `EXPLAIN` needs.
 *
 * It replaces the cached client on `globalThis` that `getDb()` reads, so it must
 * be restored afterwards; `restore()` does that and closes the connection.
 */
export function createRecordingDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — the integration suite needs a migrated Postgres.",
    );
  }

  const recorded: { query: string; params: unknown[] }[] = [];
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, {
    schema,
    logger: {
      logQuery(query, params) {
        recorded.push({ query, params });
      },
    },
  });

  const globalForDb = globalThis as typeof globalThis & {
    __teachersDb?: unknown;
  };
  const previous = globalForDb.__teachersDb;
  globalForDb.__teachersDb = db;

  return {
    db,
    client,
    recorded,
    clear: () => recorded.splice(0, recorded.length),
    restore: async () => {
      globalForDb.__teachersDb = previous;
      await client.end();
    },
  };
}
