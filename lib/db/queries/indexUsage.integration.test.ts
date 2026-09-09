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
 * T-008's last criterion, restated by T-028 (`ADR-011`): the range reads use an
 * index, and no scan in their plans can read another teacher's row.
 *
 * Overview §8.4 asks one thing of the read path — a statement must never touch
 * a row that is not this user's — and the schema offers two mechanisms for it:
 * an index led by `user_id`, and, on a child table, the composite foreign key
 * to the parent's `(id, user_id)` (`design/schema.md` §8). The two are asserted
 * separately here, because they are separate claims:
 *
 *  1. **the schema** — every table carrying a `user_id` column has an index
 *     whose leading column is `user_id`. A property of the DDL, which no
 *     planner has a say in;
 *  2. **the plans** — every statement the query modules send can be answered
 *     from an index, and every index scan in the plan binds `user_id` in its
 *     `Index Cond`.
 *
 * A `Filter` is not a binding: the scan reads the row and discards it
 * afterwards, which is exactly the shape §8.4 exists to prevent. An `Index
 * Cond` that binds `user_id` — to the statement's parameter, or to the
 * `user_id` of a relation the same plan has already bound, which is what the
 * composite FK makes possible — cannot reach a foreign row at all.
 *
 * Matching index *names* against the set led by `user_id`, which is what (2)
 * did before T-028, asked a third question that neither mechanism answers. It
 * rejected `schedule_template_id_user_uq` — both of whose columns
 * `getTemplateVersions`'s join binds — and it left the suite's colour to
 * whichever of several tenant-safe indexes the planner preferred that day.
 *
 * `enable_seqscan = off` for (2): on the ~200 fixture rows the planner would
 * rightly read the table sequentially whatever indexes exist. Turning it off
 * asks "is there a usable index", which is the design question, instead of
 * "what would the planner do today", which is not.
 *
 * The SQL is captured from the modules themselves rather than written out here:
 * a transcription would prove an index for a query nobody runs. The two
 * deliberately unbound statements at the bottom are the exception — no module
 * sends them, and they exist to prove the rule still rejects what it must.
 *
 * Needs a migrated database — `npm run test:integration`.
 */

const recording = createRecordingDatabase();
const { db, client, recorded, clear, restore } = recording;

let userId: string;

const RANGE = { from: "2026-10-12", to: "2026-11-13" };

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  "Index Cond"?: string;
  Filter?: string;
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
 * The plans of each statement, with sequential scans disabled.
 *
 * The `EXPLAIN`s run inside one transaction so that `set local` puts sequential
 * scans back on the way out, and on that transaction's own connection — the
 * recording client holds a single connection, and reaching for a second one
 * while the transaction has it would wait for itself.
 */
async function explain(
  statements: { query: string; params: unknown[] }[],
): Promise<PlanNode[][]> {
  const plans: PlanNode[][] = [];
  await client.begin(async (sql) => {
    await sql.unsafe("set local enable_seqscan = off");
    for (const statement of statements) {
      plans.push(await planOf(sql, statement.query, statement.params));
    }
  });
  return plans;
}

/** Runs a query module and returns the plans of every statement it sent. */
async function plansOf(run: () => Promise<unknown>): Promise<PlanNode[][]> {
  clear();
  await run();
  const statements = [...recorded];
  expect(statements.length).toBeGreaterThan(0);
  return explain(statements);
}

/** The nodes that read through an index; a `Bitmap Heap Scan` names none. */
function indexScansOf(plan: PlanNode[]): PlanNode[] {
  return plan.filter((node) => node["Index Name"] !== undefined);
}

/** `user_id` decided by the index, whatever it is equated to. */
const BINDS_USER_ID = /\buser_id\b\s*=/;

/**
 * `user_id` equated to a value rather than to another relation's column.
 *
 * The composite-FK join binds one side against the other, so requiring at least
 * one such scan per plan is what keeps the chain from closing on itself: some
 * scan has to be bound to the parameter `requireUser()` produced.
 */
const BINDS_USER_ID_TO_A_VALUE = /\buser_id\b\s*=\s*(?!\w+\.)/;

/** The index scans whose `Index Cond` does not bind `user_id`. */
function unboundScans(plan: PlanNode[]): PlanNode[] {
  return indexScansOf(plan).filter(
    (node) => !BINDS_USER_ID.test(node["Index Cond"] ?? ""),
  );
}

function describeScan(node: PlanNode): string {
  return `${node["Relation Name"] ?? "?"} via ${node["Index Name"]}: ${
    node["Index Cond"] ?? "no Index Cond"
  }`;
}

beforeAll(async () => {
  userId = `test-${randomUUID()}`;
  await db.insert(user).values({
    id: userId,
    name: "Integration test",
    email: `${userId}@example.test`,
    emailVerified: false,
  });
  await insertFixtureScenario(userId, db);
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

describe("the schema gives every user_id column an index that leads with it", () => {
  it("has no table carrying user_id without one", async () => {
    // Derived from the catalog rather than from a list of the ten tables of
    // `design/schema.md` §8: a table added later is covered without an edit
    // here. better-auth's `session` and `account` carry `user_id` too and are
    // held to the same rule.
    const rows = await client<{ table: string; led: boolean }[]>`
      select t.relname as table,
             exists (
               select 1
               from pg_index x
               join pg_attribute k
                 on k.attrelid = t.oid and k.attnum = x.indkey[0]
               where x.indrelid = t.oid and k.attname = 'user_id'
             ) as led
      from pg_class t
      join pg_namespace n on n.oid = t.relnamespace
      join pg_attribute a
        on a.attrelid = t.oid and a.attname = 'user_id' and a.attnum > 0
      where t.relkind = 'r' and n.nspname = 'public'
      order by t.relname
    `;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => !row.led).map((row) => row.table)).toEqual([]);
  });
});

describe("every read is answerable from an index that binds user_id", () => {
  it.each(READS)("%s", async (_name, run) => {
    for (const plan of await plansOf(run)) {
      const scans = indexScansOf(plan);

      expect(plan.map((node) => node["Node Type"])).not.toContain("Seq Scan");
      expect(scans.length).toBeGreaterThan(0);
      expect(unboundScans(plan).map(describeScan)).toEqual([]);
      expect(
        scans
          .filter((node) =>
            BINDS_USER_ID_TO_A_VALUE.test(node["Index Cond"] ?? ""),
          )
          .map(describeScan).length,
      ).toBeGreaterThan(0);
    }
  });
});

describe("a scan no user_id predicate binds is a failure", () => {
  // Neither statement is sent by any module. They are the proof that the rule
  // above still rejects: relax it to accept a scan with no `Index Cond`, or to
  // count `user_id` wherever it appears in the plan, and one of them goes green.

  it("reports a range read with no user_id predicate at all", async () => {
    const [plan] = await explain([
      {
        query: `select id from event where date_from >= $1 and date_from <= $2`,
        params: [RANGE.from, RANGE.to],
      },
    ]);

    expect(indexScansOf(plan).length).toBeGreaterThan(0);
    expect(unboundScans(plan).length).toBeGreaterThan(0);
  });

  it("reports a read whose user_id lands in the Filter", async () => {
    // `user_id || ''` is not indexable, so the predicate cannot become an
    // `Index Cond` on any index the planner picks — the row is read first and
    // discarded after, which is the shape §8.4 rules out.
    const [plan] = await explain([
      {
        query: `select id from event
                where date_from >= $1 and date_from <= $2 and user_id || '' = $3`,
        params: [RANGE.from, RANGE.to, userId],
      },
    ]);

    // The `Filter` sits on the `Bitmap Heap Scan` above the index scan, which is
    // the point: `user_id` is in the plan, and the scan is still unbound.
    expect(plan.some((node) => (node.Filter ?? "").includes("user_id"))).toBe(
      true,
    );
    expect(unboundScans(plan).length).toBeGreaterThan(0);
  });
});
