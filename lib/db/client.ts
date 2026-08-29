import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof createDb>;

// Cached on globalThis, not in a module-level `let`: `next dev` re-evaluates a
// module on every hot reload, and a per-module cache would open a fresh pool of
// `max` connections each time until Postgres refuses new ones.
const globalForDb = globalThis as typeof globalThis & {
  __teachersDb?: Database;
};

// The whole schema is registered on the client so that `db.query.*` and
// better-auth's Drizzle adapter can resolve a table by name.
function createDb(url: string) {
  return drizzle(postgres(url, { max: 10 }), { schema });
}

/**
 * The Drizzle client, created on first use.
 *
 * Lazy on purpose: `next build` and the unit tests load these modules without a
 * live database, and a connection opened at import time would make both of them
 * depend on `DATABASE_URL`.
 */
export function getDb(): Database {
  if (!globalForDb.__teachersDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set — copy .env.example to .env");
    }
    globalForDb.__teachersDb = createDb(url);
  }
  return globalForDb.__teachersDb;
}

/**
 * Closes the cached client, if one was ever created.
 *
 * For scripts and the integration suite: `getDb()`'s pool is deliberately never
 * closed in the application — the server keeps it for the process's life — but a
 * test run that leaves idle connections open holds Vitest's process open with
 * them. Application code has no reason to call this.
 */
export async function closeDb(): Promise<void> {
  const db = globalForDb.__teachersDb;
  if (!db) return;
  globalForDb.__teachersDb = undefined;
  await db.$client.end();
}
