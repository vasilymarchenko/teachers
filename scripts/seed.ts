/**
 * Seeds the fixture scenario of `docs/architecture/design/expand-fixtures.md` §3
 * for the demo teacher.
 *
 * The rows themselves are `lib/db/fixtures/scenarioRows.ts` — one transcription
 * of §3, shared with the integration suite. This script is the part that is only
 * about the demo database: the user, the production guard and the reset.
 *
 * Run after `drizzle-kit migrate` has applied the whole set, never against a
 * partially migrated database: several properties of the fixture are proved by
 * constraints rather than by assertions here
 * (`docs/architecture/design/schema.md` §9.1).
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { insertFixtureScenario } from "@/lib/db/fixtures/scenarioRows";
import { user } from "@/lib/db/schema";

config({ path: ".env", quiet: true });

// It deletes data. The guard is the difference between a demo reset and an
// accident on the VPS (T-015).
if (process.env.NODE_ENV === "production" && !process.env.SEED_ALLOW_PRODUCTION) {
  throw new Error(
    "Refusing to seed with NODE_ENV=production. Set SEED_ALLOW_PRODUCTION=1 to override.",
  );
}

const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL ?? "demo@teachers.local";
const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD ?? "demo-password-1";
const SEED_USER_NAME = "Ковальчук М. І.";

async function main() {
  const db = getDb();

  // Idempotency: the demo user's rows go with the user, through
  // `ON DELETE CASCADE` (schema §10). Running the seed twice leaves the same
  // database.
  //
  // This delete and the sign-up below are outside the transaction that
  // `insertFixtureScenario()` opens, because better-auth's API owns its own
  // connection and cannot join one. A failure partway leaves a half-seeded
  // user, which the next run clears — idempotency rather than atomicity, as
  // schema §10 records.
  await db.delete(user).where(eq(user.email, SEED_USER_EMAIL));

  // Through better-auth's own API rather than an INSERT into its tables, so the
  // password hash is what better-auth expects (schema §10).
  const signUp = await getAuth().api.signUpEmail({
    body: {
      email: SEED_USER_EMAIL,
      password: SEED_USER_PASSWORD,
      name: SEED_USER_NAME,
    },
  });
  const userId = signUp.user.id;

  await insertFixtureScenario(userId, db);

  console.log(`Seeded the fixture scenario for ${SEED_USER_EMAIL} (user ${userId}).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
