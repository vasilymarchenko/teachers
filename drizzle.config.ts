import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env", quiet: true });

export default defineConfig({
  dialect: "postgresql",
  // One schema file per aggregate lands here in T-004; the glob already
  // matches so `drizzle-kit generate` needs no change when it does.
  schema: "./lib/db/schema/*.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
