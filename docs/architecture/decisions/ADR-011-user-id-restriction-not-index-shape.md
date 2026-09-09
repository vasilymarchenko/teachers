---
id: ADR-011
title: Assert that a read is restricted to one owner, not that the index applies the restriction
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
to `schedule_template` on `(template_id, user_id) = (id, user_id)`. It failed on
`3d57e3b` and `e1f5011` on `main` (CI run `34356203852`) and earlier on `366952f`
of an unmerged branch, always because the planner had chosen an index whose
leading column is not `user_id`.

Investigating it produced the fact the rule was missing: **at fixture size that
statement has no stable plan.** Over the ~200 rows the fixtures insert, three
plans were observed for the one statement, and which one appears depends on the
table's statistics — that is, on whether autovacuum has reached it:

| Driving relation | `template_slot` reached by | `user_id` applied |
|---|---|---|
| `template_slot`, bound by `user_id` | — | `Index Cond` |
| `schedule_template`, bound by `user_id` | `template_slot_cell_uq`, by `template_id` | `Filter`, or entailed and dropped |
| `template_slot`, scanned whole | `template_slot_cell_uq`, no condition | `Filter` |

Every one of them returns exactly one teacher's rows. They differ in where the
restriction is applied, and a 200-row table is small enough that Postgres is
right to read it whole and filter afterwards. A rule that requires the
restriction to reach the index therefore asserts the planner's cost model at a
size that says nothing about production, which is what made the failure look
like a flake for three sessions.

## Options

**Stabilise the plan.** `ANALYZE` after the fixture insert, or more fixture
rows, so the planner stops moving. Cheap, and it turns CI green today. It leaves
the rule asserting something the architecture does not mean, and makes the suite
green because the planner was steered — the next statistics change reopens it.

**Index the join differently.** Add `schedule_template (user_id, id)` so that
whatever the planner picks leads with `user_id`. A redundant index on every
parent table for the sake of a test, and it does not address the plan that scans
a whole index and filters.

**Drop the plan assertion**, keeping only "no `Seq Scan`". The invariant most
worth automating stops being automated.

**Assert that the index applies the restriction** — every index scan binds
`user_id` in its `Index Cond`. This was implemented and rejected on evidence: it
accepts the composite-FK join that started the ticket, but rejects the other two
plans above, and the suite failed roughly one run in five as statistics moved.

**Assert that the restriction exists.** Hold the plan to what the statement
guarantees — every relation it reads is restricted to one owner — and assert
separately, against the catalog, that an index able to carry that restriction
exists. Chosen.

## Decision

Two assertions, because they are two claims, and only one of them involves a
planner:

1. **The schema.** Every table carrying a `user_id` column has a valid,
   non-partial index whose leading column is `user_id`, read from `pg_index`.
   This is the claim that the restriction can always be pushed into an index —
   the scalability half of §8.4 — and no plan is consulted for it.

2. **The plans.** No `Seq Scan`, at least one index answers the statement, and
   every relation the plan reads is restricted to one owner. A relation is
   restricted when
   - `user_id` is equated to a value, or to the `user_id` of a relation the plan
     has already restricted; or
   - a foreign key of the table is equated to a key of a parent the plan has
     already restricted — `(template_id = schedule_template.id)` reaches the
     slots of one template, and that template has one owner. The parent column
     must be a key on its own, or "one parent row" is not true. This is the
     composite FK of `design/schema.md` §8 doing read-path work.

   An `Index Cond` and a `Filter` count alike. "Already restricted" carries the
   weight in both clauses: the resolution starts from the relations restricted
   to a *value* — a parameter or a literal — and reaches the rest from there, so
   a chain cannot close on a `CTE` or `VALUES` list that nothing vouches for, and
   one relation's literal cannot answer for another's.

   Two consequences of taking "every relation" literally:

   - **the unit is the scan, not the table or its alias.** Two branches of an
     `Append` are one alias and two reads, and an alias may vouch for another
     relation only when every scan carrying it is restricted;
   - **the arms of a `BitmapOr` are alternatives**, so an arm that restricts
     `user_id` restricts nothing on its own. Their conditions are dropped rather
     than modelled, which makes a read restricted only through a `BitmapOr` come
     out red. No read sends one; a red for a plan that may be safe is the
     direction this rule is allowed to be wrong in.

The rule is `lib/db/planBinding.ts`, exercised against real plans by
`indexUsage.integration.test.ts` and against the plan shapes a 200-row fixture
will not produce by `planBinding.test.ts`.

## Consequences

The suite no longer depends on which plan the planner chooses: thirty
consecutive runs pass, before and after `ANALYZE`, where the previous rule
failed about one run in five. A ticket that adds fixture rows cannot turn it red
for a reason that is not a defect.

What is given up is the claim that a read never *reads* a foreign row, only that
it never returns one. At fixture size that claim cannot be tested — the plan
that reads the table whole is the correct plan for 200 rows — and asserting it
would be asserting the cost model. Assertion 1 is what stands in for it: the
index exists, so the restriction is pushed down when the table is large enough
for it to matter. A regression that only appears at production size would not be
caught here, and the trigger for revisiting this is a real data set: if the
suite ever runs against one, assertion 2 can be tightened to require the
`Index Cond` and the two claims merge again.

The rule reads plan text — `Index Cond` and `Filter` as Postgres renders them —
which is output format rather than contract, so a major version that renders
conditions differently needs the matcher updated. It fails closed: a value form
the matcher does not recognise makes a test red, never green. Every clause is
falsifiable, and each was checked by removing it and watching a case go red.
