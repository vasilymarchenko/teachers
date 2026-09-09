---
id: ADR-011
title: Assert that a scan binds user_id, not that its index leads with it
status: accepted
date: 2026-09-09
ticket: T-028
---

## Context

Overview §8.4 requires that a read never touch a row belonging to another
teacher. `lib/db/queries/indexUsage.integration.test.ts` (T-008) enforced it by
running `EXPLAIN` on every statement the query modules send and asserting that
each index the plan names is one whose leading column is `user_id`.

`getTemplateVersions` sends two statements, and the second joins `template_slot`
to `schedule_template` on `(template_id, user_id) = (id, user_id)`. That join is
what `schedule_template_id_user_uq`, the `UNIQUE (id, user_id)` composite-FK
target of `design/schema.md` §8, exists to serve. When the planner answers the
join through it, both of the index's columns are bound by the join and the scan
cannot reach another teacher's row — and the test failed, because the index's
leading column is `id`.

It is not a flake. The case failed on `3d57e3b` and `e1f5011` on `main` (CI run
`34356203852`) and earlier on `366952f` of an unmerged branch. What varies is
the planner's choice for that join: with `enable_seqscan = off` over ~200 fixture
rows, `schedule_template_id_user_uq` and `schedule_template_no_overlap_ex` are
near-equal, and row counts a later ticket adds decide between them.

The schema provides two mechanisms for the §8.4 guarantee — a `user_id`-led
index, and the composite FK on a child table — and §8.4 named only the first.
The test was written against that wording and therefore inherited the gap.

## Options

**Stabilise the plan.** `ANALYZE` after the fixture insert, or more fixture
rows, so the planner stops preferring the composite index. Cheap and it turns CI
green today. It leaves the rule saying something the architecture does not mean,
and makes the suite green because the planner was steered — the next statistics
change reopens it, and the failure will again look like a flake.

**Index the join differently.** Add an index on `schedule_template (user_id, id)`
so that whatever the planner picks leads with `user_id`. It buys a redundant
index on every child table's parent for the sake of a test, and still says
nothing about scans that bind no `user_id` at all.

**Drop the plan assertion**, keeping only "no `Seq Scan`". The invariant most
worth automating stops being automated.

**Restate the rule as binding.** Assert that every index scan binds `user_id` in
its `Index Cond` — to the statement's parameter or to the `user_id` of a
relation the same plan has already bound. This says what §8.4 means rather than
what it happened to produce, and accepts either mechanism.

## Decision

The last one. Two assertions, because they are two claims:

1. **the schema** — every table carrying a `user_id` column has an index whose
   leading column is `user_id`, read from the catalog, with no planner involved;
2. **the plans** — no `Seq Scan`, at least one index, and every index scan in
   the plan binds `user_id` in its `Index Cond`. A `Filter` is not a binding:
   the row is read and discarded afterwards, which is the shape §8.4 rules out.
   At least one scan per plan must bind `user_id` to a value rather than to
   another relation's column, so a composite-FK join cannot close the chain on
   itself.

Overview §8.4 now names both mechanisms, and `design/schema.md` §8 says that the
composite key is a read-path mechanism and not only an integrity one.

## Consequences

The suite no longer depends on which tenant-safe index the planner chooses, so a
ticket that adds fixture rows cannot turn it red for the wrong reason. In one
direction the rule is stricter than the one it replaces: an index led by
`user_id` no longer passes on its shape alone, the statement has to actually
bind the column. A read that binds `user_id` only through a `Filter` now fails —
that is a true finding about the data path, and the fix belongs in the query or
the schema, never in the test.

The cost is that the rule reads a plan's `Index Cond` as text, which is
Postgres's output format rather than a contract; a future major version that
renders conditions differently would need the matcher updated. Two cases
`EXPLAIN` statements no module sends — one with no `user_id` predicate, one
whose `user_id` can only reach the `Filter` — so that a relaxation of the
matcher turns something red instead of quietly passing everything.

Revisit if a legitimate read cannot express its tenancy through an `Index Cond`
— a join whose parent is bound but whose child is reached by primary key alone
would be tenant-safe and would fail this rule. The answer then is to extend the
rule to follow that binding through the foreign key, not to return to matching
index names.
