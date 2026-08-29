import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * The housekeeping columns of `docs/architecture/design/schema.md` §1, so that
 * the ten profile tables state them once each instead of restating the rule.
 *
 * Each helper is a function, not a shared object: a Drizzle column builder is
 * mutated by `.notNull()` and friends, so handing the same instance to two
 * tables would let one table's definition alter the other's.
 */

/** `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`. */
export const primaryId = () => uuid("id").primaryKey().defaultRandom();

/**
 * `user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE` — on every
 * profile table, child tables included (§8).
 *
 * `text` and not `uuid`: better-auth's id generator produces a string, and a
 * foreign key cannot bridge the two types (§1, §5.1). Do not "tidy" it.
 */
export const ownerId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

/**
 * `created_at` / `updated_at`, both `timestamptz NOT NULL DEFAULT now()`.
 *
 * The SQL default fires on `INSERT` only. `updated_at` is maintained by
 * `.$onUpdate()` in the application rather than by a per-table trigger, so a row
 * written outside Drizzle keeps its insert value — the accepted cost recorded
 * in §1.
 */
export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
