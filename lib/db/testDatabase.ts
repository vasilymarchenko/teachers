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
