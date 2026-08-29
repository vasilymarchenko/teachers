import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env", quiet: true });

export default defineConfig({
  dialect: "postgresql",
  // One schema file per aggregate, and only those: the tests that live beside
  // them are excluded on purpose. drizzle-kit `require()`s every file the glob
  // matches, and a test file importing `vitest` outside a Vitest run throws —
  // which drizzle-kit reports without a non-zero exit, so a plain `*.ts` here
  // makes `db:generate` fail silently.
  schema: "./lib/db/schema/!(*.test).ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
