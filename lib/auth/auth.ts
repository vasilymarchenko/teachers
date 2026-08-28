import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/lib/db/client";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg" }),
    emailAndPassword: { enabled: true },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/**
 * The better-auth instance, created on first use (same reason as `getDb()`).
 *
 * Scope for now is the wiring only: the adapter, the mounted route handler and
 * the health check next to it. The auth tables, `requireUser()` and the sign-in
 * flow are T-006.
 */
export function getAuth() {
  return (instance ??= createAuth());
}
