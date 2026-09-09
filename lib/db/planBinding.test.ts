import { describe, expect, it } from "vitest";
import type { ForeignKey, PlanNode } from "./planBinding";
import { unboundRelations, violationsOf } from "./planBinding";

/**
 * The plan shapes the rule of `planBinding.ts` has to judge correctly and that
 * `indexUsage.integration.test.ts` cannot obtain from a planner.
 *
 Over the ~200 fixture rows the planner will not build them: it reads a small
 * table once rather than driving a join from a `VALUES` list, and every read
 * these modules send restricts `user_id` somewhere. They are still the plans
 * §8.4 rules out, and a rule nothing can falsify is a rule nobody can trust —
 * so they are written out here. Each is a shape `EXPLAIN` prints, transcribed
 * from real output; none is a statement any module sends.
 */

/** The schema's one composite FK, as `foreignKeysToAKey()` reads it back. */
const FOREIGN_KEYS: ForeignKey[] = [
  {
    table: "template_slot",
    column: "template_id",
    parent: "schedule_template",
    parentColumn: "id",
  },
  {
    table: "template_slot",
    column: "user_id",
    parent: "schedule_template",
    parentColumn: "user_id",
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
  it.each([
    ["a VALUES relation", '(user_id = "*VALUES*".column1)'],
    ["a CTE, through a cast", "(user_id = (u.user_id)::text)"],
  ])("reports a plan whose only binding is to %s", (_name, cond) => {
    const scan: PlanNode = {
      "Node Type": "Index Scan",
      "Relation Name": "event",
      Alias: "event",
      "Index Name": "event_user_date_idx",
      "Index Cond": cond,
    };
    const plan: PlanNode[] = [
      {
        "Node Type": "Nested Loop",
        Plans: [{ "Node Type": "Values Scan" }, scan],
      },
      { "Node Type": "Values Scan" },
      scan,
    ];

    // Bound — and vouched for by nothing, because the relation it is bound to
    // is not one this rule can follow.
    expect(unboundRelations(plan, FOREIGN_KEYS)).toEqual([]);
    expect(violationsOf(plan, FOREIGN_KEYS)).toEqual([
      "no scan binds user_id to a value",
    ]);
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
