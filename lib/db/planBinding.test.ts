import { describe, expect, it } from "vitest";
import type { ForeignKey, PlanNode } from "./planBinding";
import { unboundRelations, violationsOf } from "./planBinding";

/**
 * The plan shapes the rule of `planBinding.ts` has to judge correctly and that
 * `indexUsage.integration.test.ts` cannot obtain from a planner.
 *
 * Over the ~200 fixture rows the planner will not build them: it reads a small
 * table once rather than driving a join from a `VALUES` list, and every read
 * these modules send restricts `user_id` somewhere. They are still the plans
 * §8.4 rules out, and a rule nothing can falsify is a rule nobody can trust —
 * so they are written out here. Each is a shape `EXPLAIN` prints, transcribed
 * from real output; none is a statement any module sends.
 */

/**
 * The composite-FK legs `foreignKeysToAKey()` returns, transcribed from the
 * catalog of a migrated database.
 *
 * `template_slot`, `semester` and `non_teaching_period` each carry a composite
 * foreign key to their parent's `(id, user_id)` (`design/schema.md` §8), and of
 * each one only the leg to the parent's `id` survives that query's filter: `id`
 * is a key of the parent on its own, `user_id` is not — `schedule_template`
 * indexes it only as the two-column `schedule_template_id_user_uq`. A pair the
 * catalog cannot produce does not belong here: it would let a plan pass this
 * suite through a mechanism the integration suite never offers it.
 *
 * The real set also holds every table's `user_id -> user.id`, which is a key
 * pair like any other; no plan below is restricted through one.
 */
const FOREIGN_KEYS: ForeignKey[] = [
  {
    table: "template_slot",
    column: "template_id",
    parent: "schedule_template",
    parentColumn: "id",
  },
  {
    table: "semester",
    column: "academic_year_id",
    parent: "academic_year",
    parentColumn: "id",
  },
  {
    table: "non_teaching_period",
    column: "academic_year_id",
    parent: "academic_year",
    parentColumn: "id",
  },
];

const boundParent: PlanNode = {
  "Node Type": "Index Scan",
  "Relation Name": "schedule_template",
  Alias: "schedule_template",
  "Index Name": "schedule_template_no_overlap_ex",
  "Index Cond": "(user_id = 'u-1'::text)",
};

/**
 * The slots reached by template id alone. Postgres drops the child's own
 * `user_id` qual when the join equality and the parent's qual already entail it,
 * and then this scan carries no restriction of its own at all.
 */
const slotsByTemplateId: PlanNode = {
  "Node Type": "Index Scan",
  "Relation Name": "template_slot",
  Alias: "template_slot",
  "Index Name": "template_slot_cell_uq",
  "Index Cond": "(template_id = schedule_template.id)",
};

describe("a foreign key to a bound parent binds the child", () => {
  it("accepts the slots reached by template_id from a bound template", () => {
    // The plan accurate statistics produce for `getTemplateVersions` (T-028):
    // the parent is bound by `user_id`, the child by a key of that parent, and
    // `id` is unique — so the scan reaches one template's slots and no others.
    const plan: PlanNode[] = [
      { "Node Type": "Nested Loop", Plans: [boundParent, slotsByTemplateId] },
      boundParent,
      slotsByTemplateId,
    ];

    expect(violationsOf(plan, FOREIGN_KEYS)).toEqual([]);
  });

  it("reports the same child when the parent is not bound", () => {
    const looseParent: PlanNode = {
      ...boundParent,
      "Index Cond": "(valid_from <= '2026-11-13'::date)",
    };
    const plan: PlanNode[] = [
      { "Node Type": "Nested Loop", Plans: [looseParent, slotsByTemplateId] },
      looseParent,
      slotsByTemplateId,
    ];

    // Both, and in that order: the parent reads every teacher's templates, so
    // the key the child is bound to vouches for nothing.
    expect(violationsOf(plan, FOREIGN_KEYS)).toEqual([
      "unbound: schedule_template via schedule_template_no_overlap_ex: (valid_from <= '2026-11-13'::date)",
      "unbound: template_slot via template_slot_cell_uq: (template_id = schedule_template.id)",
      "no scan binds user_id to a value",
    ]);
  });

  it("reports a child joined to a bound parent by something that is not a key", () => {
    // `date_from = schedule_template.valid_from` binds the scan to a bound
    // relation just as tightly as a foreign key does, and selects rows by a
    // date every teacher has. Only a key that identifies one parent row carries
    // the owner with it.
    const byDate: PlanNode = {
      "Node Type": "Index Scan",
      "Relation Name": "event",
      Alias: "event",
      "Index Name": "event_user_date_idx",
      "Index Cond": "(date_from = schedule_template.valid_from)",
    };
    const plan: PlanNode[] = [
      { "Node Type": "Nested Loop", Plans: [boundParent, byDate] },
      boundParent,
      byDate,
    ];

    expect(violationsOf(plan, FOREIGN_KEYS)).toEqual([
      "unbound: event via event_user_date_idx: (date_from = schedule_template.valid_from)",
    ]);
  });
});

describe("a Filter restricts the read as an Index Cond does", () => {
  it("accepts a scan whose user_id reaches only the Filter", () => {
    // The plan the fixture size produces from one run to the next: the table is
    // small enough to read whole, so `user_id` is applied to the rows rather
    // than through the index. The read still returns one owner's rows, which is
    // what §8.4 asks; that an index *could* carry the restriction is the
    // catalog's claim, not this plan's (`ADR-011`).
    const plan: PlanNode[] = [
      {
        "Node Type": "Index Scan",
        "Relation Name": "template_slot",
        Alias: "template_slot",
        "Index Name": "template_slot_cell_uq",
        Filter: "(user_id = 'u-1'::text)",
      },
    ];

    expect(violationsOf(plan, FOREIGN_KEYS)).toEqual([]);
  });

  it("reports a scan whose user_id is not restricted at all", () => {
    // The same shape with no `user_id` anywhere: every teacher's slots are read
    // and returned.
    const plan: PlanNode[] = [
      {
        "Node Type": "Index Scan",
        "Relation Name": "template_slot",
        Alias: "template_slot",
        "Index Name": "template_slot_cell_uq",
        "Index Cond": "(weekday = 'MON'::weekday)",
        Filter: "(lesson_number = 1)",
      },
    ];

    expect(violationsOf(plan, FOREIGN_KEYS).join("\n")).toContain("unbound: ");
  });
});

describe("the chain has to end at a value", () => {
  const eventBoundTo = (cond: string): PlanNode => ({
    "Node Type": "Index Scan",
    "Relation Name": "event",
    Alias: "event",
    "Index Name": "event_user_date_idx",
    "Index Cond": cond,
  });

  it.each([
    ["a VALUES relation", '(user_id = "*VALUES*".column1)'],
    ["a CTE, through a cast", "(user_id = (u.user_id)::text)"],
  ])("reports a plan whose only binding is to %s", (_name, cond) => {
    const scan = eventBoundTo(cond);
    const plan: PlanNode[] = [
      {
        "Node Type": "Nested Loop",
        Plans: [{ "Node Type": "Values Scan" }, scan],
      },
      { "Node Type": "Values Scan" },
      scan,
    ];

    // `user_id` is equated to something, and that something vouches for
    // nothing: neither relation is one this rule can follow to a value. The
    // scan is unrestricted, not merely unwitnessed.
    expect(unboundRelations(plan, FOREIGN_KEYS)).toHaveLength(1);
    expect(violationsOf(plan, FOREIGN_KEYS)).toEqual([
      "unbound: event via event_user_date_idx: (user_id = " +
        cond.slice("(user_id = ".length),
      "no scan binds user_id to a value",
    ]);
  });

  it("does not let a second relation's literal vouch for the first", () => {
    // The hole a plan-wide "somebody reached a value" check leaves open: the
    // `day_override` scan supplies the literal, and the `event` scan is bound
    // to a `VALUES` list nothing restricts. One of the two returns every
    // teacher's rows, and §8.4 asks after *each* relation the plan reads.
    const scan = eventBoundTo('(user_id = "*VALUES*".column1)');
    const literal: PlanNode = {
      "Node Type": "Index Scan",
      "Relation Name": "day_override",
      Alias: "day_override",
      "Index Name": "day_override_user_date_uq",
      "Index Cond": "(user_id = 'u-1'::text)",
    };
    const plan: PlanNode[] = [
      { "Node Type": "Nested Loop", Plans: [literal, scan] },
      literal,
      scan,
    ];

    expect(violationsOf(plan, FOREIGN_KEYS)).toEqual([
      'unbound: event via event_user_date_idx: (user_id = "*VALUES*".column1)',
    ]);
  });

  it("accepts a relation bound to the user_id of a bound one", () => {
    // The clause the case above is the limit of: `schedule_template` is
    // restricted to a value, so a scan equated to *its* `user_id` reads that
    // owner's rows and no others.
    const joined: PlanNode = {
      "Node Type": "Index Scan",
      "Relation Name": "event",
      Alias: "event",
      "Index Name": "event_user_date_idx",
      "Index Cond": "(user_id = schedule_template.user_id)",
    };
    const plan: PlanNode[] = [
      { "Node Type": "Nested Loop", Plans: [boundParent, joined] },
      boundParent,
      joined,
    ];

    expect(violationsOf(plan, FOREIGN_KEYS)).toEqual([]);
  });
});

describe("an alias is not a read", () => {
  it("reports the unbound branch of an Append that shares its alias", () => {
    // Both branches are `event`. Judged by alias the restricted one answers for
    // the other, and a partitioned or UNION read that scans every teacher's
    // rows in one branch passes.
    const branch = (cond: string): PlanNode => ({
      "Node Type": "Index Scan",
      "Relation Name": "event",
      Alias: "event",
      "Index Name": "event_user_date_idx",
      "Index Cond": cond,
    });
    const bound = branch("(user_id = 'u-1'::text)");
    const loose = branch("(date_from >= '2026-10-12'::date)");
    const plan: PlanNode[] = [
      { "Node Type": "Append", Plans: [bound, loose] },
      bound,
      loose,
    ];

    expect(violationsOf(plan, FOREIGN_KEYS)).toEqual([
      "unbound: event via event_user_date_idx: (date_from >= '2026-10-12'::date)",
    ]);
  });
});

describe("the arms of a BitmapOr are alternatives", () => {
  it("reports a read one of whose arms is not restricted", () => {
    // `user_id = 'u-1' OR date_from = …` returns a row when *either* holds, so
    // the restricted arm restricts nothing: the read returns every teacher's
    // rows for that date. Concatenated into one condition string it reads
    // exactly like the conjunction that would be safe.
    const plan: PlanNode[] = [
      {
        "Node Type": "Bitmap Heap Scan",
        "Relation Name": "event",
        Alias: "event",
        Plans: [
          {
            "Node Type": "BitmapOr",
            Plans: [
              {
                "Node Type": "Bitmap Index Scan",
                "Index Name": "event_user_date_idx",
                "Index Cond": "(user_id = 'u-1'::text)",
              },
              {
                "Node Type": "Bitmap Index Scan",
                "Index Name": "event_user_date_idx",
                "Index Cond": "(date_from = '2026-10-12'::date)",
              },
            ],
          },
        ],
      },
    ];

    expect(violationsOf(plan, FOREIGN_KEYS).join("\n")).toContain("unbound: ");
  });
});

describe("a bitmap scan is one read of one table", () => {
  it("takes the condition from the Bitmap Index Scan under the heap scan", () => {
    // The `Bitmap Heap Scan` names the table and the `Bitmap Index Scan` under
    // it names the index and carries the condition. Judged as two nodes, the
    // first has no index and the second no table, and the read is either
    // unbound or invisible.
    const plan: PlanNode[] = [
      {
        "Node Type": "Bitmap Heap Scan",
        "Relation Name": "event",
        Alias: "event",
        Plans: [
          {
            "Node Type": "Bitmap Index Scan",
            "Index Name": "event_user_date_idx",
            "Index Cond": "(user_id = 'u-1'::text)",
          },
        ],
      },
      {
        "Node Type": "Bitmap Index Scan",
        "Index Name": "event_user_date_idx",
        "Index Cond": "(user_id = 'u-1'::text)",
      },
    ];

    expect(violationsOf(plan, FOREIGN_KEYS)).toEqual([]);
  });
});
