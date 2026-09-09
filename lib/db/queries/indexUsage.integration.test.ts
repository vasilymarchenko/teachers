import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertFixtureScenario } from "@/lib/db/fixtures/scenarioRows";
import type { ForeignKey, PlanNode } from "@/lib/db/planBinding";
import { indexScansOf, nodesOf, violationsOf } from "@/lib/db/planBinding";
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
 * index, and none of them can return another teacher's row.
 *
 * Overview §8.4 asks one thing of the read path, and the schema offers two
 * mechanisms for it — an index led by `user_id`, and, on a child table, the
 * composite foreign key to the parent's `(id, user_id)` (`design/schema.md`
 * §8). Two claims follow, and they are asserted apart because only one of them
 * involves a planner:
 *
 *  1. **the schema** — every table carrying a `user_id` column has a valid,
 *     non-partial index whose leading column is `user_id`, read from the
 *     catalog. This is what makes the restriction pushable into an index at any
 *     size, and no plan is consulted for it;
 *  2. **the plans** — every statement the modules send is answered from an
 *     index, without a `Seq Scan`, and every relation it reads is restricted to
 *     one owner. `lib/db/planBinding.ts` holds that rule and says what counts.
 *
 * Where the restriction lands — `Index Cond` or `Filter` — is deliberately not
 * asserted: over the ~200 fixture rows the same statement is planned three
 * different ways as statistics move, and requiring the index to carry it failed
 * about one run in five for no defect (`ADR-011`).
 *
 * `enable_seqscan = off` for (2): on this many rows the planner would rightly
 * read the table sequentially whatever indexes exist. Turning it off asks "is
 * there a usable index", which is the design question, instead of "what would
 * the planner do today", which is not.
 *
 * The SQL is captured from the modules themselves rather than written out here:
 * a transcription would prove an index for a query nobody runs. The three
 * unrestricted statements at the bottom are the exception — no module sends
 * them, and they are there to prove the rule still rejects what it must. The
 * plan shapes a fixture this small will not produce are in
 * `lib/db/planBinding.test.ts`.
 *
 * Needs a migrated database — `npm run test:integration`.
 */

const recording = createRecordingDatabase();
const { db, client, recorded, clear, restore } = recording;

let userId: string;

const RANGE = { from: "2026-10-12", to: "2026-11-13" };

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

/**
 * The foreign keys whose parent column is a key of the parent on its own. Read
 * once: a plan can only be judged against the schema it was planned for.
 *
 * The uniqueness has to be total, so `indpred is null` for the same reason the
 * catalog case above gives: a partial unique index makes the column unique over
 * the rows of its predicate and no others, and "one parent row" is then true
 * only for some parents.
 */
async function foreignKeysToAKey(): Promise<ForeignKey[]> {
  return client<ForeignKey[]>`
    select ch.relname as table,
           ca.attname as column,
           pr.relname as parent,
           pa.attname as "parentColumn"
    from pg_constraint c
    join pg_class ch on ch.oid = c.conrelid
    join pg_class pr on pr.oid = c.confrelid
    join lateral unnest(c.conkey, c.confkey) as k(child, parent) on true
    join pg_attribute ca on ca.attrelid = c.conrelid and ca.attnum = k.child
    join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = k.parent
    where c.contype = 'f'
      and exists (
        select 1
        from pg_index i
        where i.indrelid = c.confrelid
          and i.indisunique
          and i.indisvalid
          and i.indpred is null
          and i.indnkeyatts = 1
          and i.indkey[0] = k.parent
      )
  `;
}

let foreignKeys: ForeignKey[];

beforeAll(async () => {
  userId = `test-${randomUUID()}`;
  await db.insert(user).values({
    id: userId,
    name: "Integration test",
    email: `${userId}@example.test`,
    emailVerified: false,
  });
  await insertFixtureScenario(userId, db);
  foreignKeys = await foreignKeysToAKey();
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

/** The ten profile tables of `design/schema.md` §8. */
const PROFILE_TABLES = [
  "academic_year",
  "bell_schedule",
  "day_override",
  "event",
  "non_teaching_period",
  "non_teaching_weekday_rule",
  "parity_anchor",
  "schedule_template",
  "semester",
  "template_slot",
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
               where x.indrelid = t.oid
                 and k.attname = 'user_id'
                 -- A partial index covers the rows of its predicate and no
                 -- others, and an index left invalid by a failed CREATE INDEX
                 -- CONCURRENTLY covers none: neither answers for the table.
                 and x.indisvalid
                 and x.indpred is null
             ) as led
      from pg_class t
      join pg_namespace n on n.oid = t.relnamespace
      join pg_attribute a
        on a.attrelid = t.oid and a.attname = 'user_id' and a.attnum > 0
      where t.relkind = 'r' and n.nspname = 'public'
      order by t.relname
    `;

    const tables = rows.map((row) => row.table);
    // The floor: every profile table of `design/schema.md` §8 is here. Without
    // it a migration that drops or renames `user_id` on one of them leaves this
    // case green — the table simply stops being one of the rows.
    expect(tables).toEqual(expect.arrayContaining(PROFILE_TABLES));
    expect(rows.filter((row) => !row.led).map((row) => row.table)).toEqual([]);
  });
});

describe("every read is answerable from an index that binds user_id", () => {
  it.each(READS)("%s", async (_name, run) => {
    for (const plan of await plansOf(run)) {
      expect(violationsOf(plan, foreignKeys)).toEqual([]);
    }
  });
});

describe("a real plan no user_id predicate binds is a failure", () => {
  // None of these statements is sent by any module: they are the plans a
  // planner will actually build for a read that is not bound. The shapes it
  // will not build here — a `Filter` standing in for a binding, a chain that
  // closes on a `VALUES` relation — are in `lib/db/planBinding.test.ts`.

  it("reports a range read with no user_id predicate at all", async () => {
    // Bound by `date_from` and by nothing else — the index leads with `user_id`
    // and the scan still reads every teacher's rows in the window.
    const [plan] = await explain([
      {
        query: `select id from event where date_from >= $1 and date_from <= $2`,
        params: [RANGE.from, RANGE.to],
      },
    ]);

    expect(indexScansOf(plan).length).toBeGreaterThan(0);
    expect(violationsOf(plan, foreignKeys).join("\n")).toContain("unbound: ");
  });

  it("reports a read that scans an entire index", async () => {
    // No `Index Cond` at all. Accept a missing condition as "nothing to check"
    // — the easiest relaxation to write by accident — and this one goes green.
    const [plan] = await explain([
      {
        query: `select user_id, date_from from event order by user_id, date_from`,
        params: [],
      },
    ]);

    const scans = indexScansOf(plan);
    expect(scans.length).toBeGreaterThan(0);
    expect(scans.every((node) => node["Index Cond"] === undefined)).toBe(true);
    expect(violationsOf(plan, foreignKeys).join("\n")).toContain("unbound: ");
  });

  it("reports a read whose user_id lands in the Filter", async () => {
    // `user_id || ''` is not indexable, so the predicate cannot become an
    // `Index Cond` on any index the planner picks: the row is read first and
    // discarded after, which is the shape §8.4 rules out. This is the real-plan
    // half of that case; the half where the `Filter` is a plain `user_id = …`
    // that a relaxed rule would count is in `planBinding.test.ts`.
    const [plan] = await explain([
      {
        query: `select id from event
                where date_from >= $1 and date_from <= $2 and user_id || '' = $3`,
        params: [RANGE.from, RANGE.to, userId],
      },
    ]);

    expect(plan.some((node) => (node.Filter ?? "").includes("user_id"))).toBe(
      true,
    );
    expect(violationsOf(plan, foreignKeys).join("\n")).toContain("unbound: ");
  });
});
