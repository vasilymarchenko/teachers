import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertFixtureScenario } from "@/lib/db/fixtures/scenarioRows";
import { user } from "@/lib/db/schema";
import { createRecordingDatabase } from "@/lib/db/testDatabase";
import { getBellSchedule } from "./bells";
import {
  getNonTeachingPeriods,
  getNonTeachingWeekdayRules,
} from "./calendarRules";
import { getEventsInRange } from "./events";
import { getDayOverrides } from "./overrides";
import { getParityAnchors } from "./parityAnchors";
import { getTemplateVersions } from "./templates";
import { getYearFrame } from "./yearFrame";

/**
 * T-008's last criterion: the range reads use an index, and every index they
 * use starts with `user_id` (overview §8.4, third bullet).
 *
 * Two things are checked, and the second is the one that matters in a year's
 * time:
 *
 *  1. every statement the query modules send can be answered from an index —
 *     asserted with `enable_seqscan = off`, because on the ~200 fixture rows the
 *     planner would rightly read the table sequentially whatever indexes exist.
 *     Turning it off asks "is there a usable index", which is the design
 *     question, instead of "what would the planner do today", which is not;
 *  2. every index they chose is one whose leading column is `user_id`. An index
 *     that starts anywhere else would return another teacher's rows first and
 *     filter them out afterwards — the shape §8.4 exists to prevent.
 *
 * The SQL is captured from the modules themselves rather than written out here:
 * a transcription would prove an index for a query nobody runs.
 *
 * Needs a migrated database — `npm run test:integration`.
 */

const recording = createRecordingDatabase();
const { db, client, recorded, clear, restore } = recording;

let userId: string;

const RANGE = { from: "2026-10-12", to: "2026-11-13" };

type PlanNode = {
  "Node Type": string;
  "Index Name"?: string;
  Plans?: PlanNode[];
};

function nodesOf(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(nodesOf)];
}

/** Every plan node of one statement, top-level node first. */
async function planOf(
  sql: TransactionSql,
  query: string,
  params: unknown[],
): Promise<PlanNode[]> {
  const rows = await sql.unsafe(
    `explain (format json) ${query}`,
    params as never[],
  );
  // The column is literally named `QUERY PLAN`, and `EXPLAIN (FORMAT JSON)`
  // returns one row holding an array with one plan in it.
  const [{ Plan }] = (rows[0] as unknown as {
    "QUERY PLAN": { Plan: PlanNode }[];
  })["QUERY PLAN"];
  return nodesOf(Plan);
}

/**
 * Runs a query module and returns the plans of every statement it sent.
 *
 * The `EXPLAIN`s run inside one transaction so that `set local` puts sequential
 * scans back on the way out, and on that transaction's own connection — the
 * recording client holds a single connection, and reaching for a second one
 * while the transaction has it would wait for itself.
 */
async function plansOf(run: () => Promise<unknown>): Promise<PlanNode[][]> {
  clear();
  await run();
  const statements = [...recorded];
  expect(statements.length).toBeGreaterThan(0);

  const plans: PlanNode[][] = [];
  await client.begin(async (sql) => {
    await sql.unsafe("set local enable_seqscan = off");
    for (const statement of statements) {
      plans.push(await planOf(sql, statement.query, statement.params));
    }
  });
  return plans;
}

/** The indexes of this database whose first column is `user_id`. */
async function indexesLedByUserId(): Promise<Set<string>> {
  const rows = await client<{ indexname: string }[]>`
    select i.relname as indexname
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_attribute a
      on a.attrelid = t.oid and a.attnum = x.indkey[0]
    where a.attname = 'user_id'
  `;
  return new Set(rows.map((row) => row.indexname));
}

let userIdIndexes: Set<string>;

beforeAll(async () => {
  userId = `test-${randomUUID()}`;
  await db.insert(user).values({
    id: userId,
    name: "Integration test",
    email: `${userId}@example.test`,
    emailVerified: false,
  });
  await insertFixtureScenario(userId, db);
  userIdIndexes = await indexesLedByUserId();
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
  await restore();
});

const READS: [name: string, run: () => Promise<unknown>][] = [
  ["getParityAnchors", () => getParityAnchors(userId, RANGE)],
  ["getNonTeachingPeriods", () => getNonTeachingPeriods(userId, RANGE)],
  ["getNonTeachingWeekdayRules", () => getNonTeachingWeekdayRules(userId, RANGE)],
  ["getBellSchedule", () => getBellSchedule(userId)],
  ["getTemplateVersions", () => getTemplateVersions(userId, RANGE)],
  ["getDayOverrides", () => getDayOverrides(userId, RANGE)],
  ["getEventsInRange", () => getEventsInRange(userId, RANGE)],
  ["getYearFrame", () => getYearFrame(userId, RANGE.from)],
];

describe("every read is answerable from an index led by user_id", () => {
  it.each(READS)("%s", async (_name, run) => {
    for (const plan of await plansOf(run)) {
      const indexes = plan
        .map((node) => node["Index Name"])
        .filter((name): name is string => name !== undefined);

      expect(indexes.length).toBeGreaterThan(0);
      expect(plan.map((node) => node["Node Type"])).not.toContain("Seq Scan");

      for (const index of indexes) {
        expect(userIdIndexes).toContain(index);
      }
    }
  });
});
