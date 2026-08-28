import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

// Proves the two connections the scaffold claims to have: Postgres through
// Drizzle, and better-auth mounted at /api/auth. Kept as a Route Handler
// because it must never be prerendered.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
  } catch (error) {
    return Response.json(
      { database: "down", reason: (error as Error).message },
      { status: 503 },
    );
  }

  return Response.json({ database: "up", auth: "/api/auth" });
}
