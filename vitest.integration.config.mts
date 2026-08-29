import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env", quiet: true });

/**
 * The integration suite — `npm run test:integration`.
 *
 * These tests talk to a real Postgres, because what they assert is what the
 * database does: the `EXCLUDE USING gist` constraint of
 * `docs/architecture/design/schema.md` §4.7 exists only in SQL, and a mock would
 * be asserting the mock. `DATABASE_URL` must point at a **migrated** database.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["lib/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    // The tests share one database and clean up after themselves, so two files
    // running at once would delete each other's rows.
    fileParallelism: false,
    // A first connection to a cold container can be slow; the assertions are not.
    testTimeout: 20_000,
    environment: "node",
  },
});
