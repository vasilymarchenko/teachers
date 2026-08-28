import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

type Database = ReturnType<typeof drizzle>;

// Cached on globalThis, not in a module-level `let`: `next dev` re-evaluates a
// module on every hot reload, and a per-module cache would open a fresh pool of
// `max` connections each time until Postgres refuses new ones.
const globalForDb = globalThis as typeof globalThis & {
  __teachersDb?: Database;
};

/**
 * The Drizzle client, created on first use.
 *
 * Lazy on purpose: `next build` and the unit tests load these modules without a
 * live database, and a connection opened at import time would make both of them
 * depend on `DATABASE_URL`.
 *
 * The schema is registered here once `lib/db/schema` exists (T-004).
 */
export function getDb(): Database {
  if (!globalForDb.__teachersDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set — copy .env.example to .env");
    }
    globalForDb.__teachersDb = drizzle(postgres(url, { max: 10 }));
  }
  return globalForDb.__teachersDb;
}
