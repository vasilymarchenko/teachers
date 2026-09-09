---
id: T-028
type: ticket
title: Make the index-usage invariant accept the composite-FK join
status: done
depends_on: [T-008]
refs:
  - lib/db/queries/indexUsage.integration.test.ts
  - lib/db/queries/templates.ts
  - lib/db/schema/scheduleTemplate.ts
  - docs/architecture/architect-overview.md §8.4
  - docs/architecture/design/schema.md §8
  - docs/architecture/design/T-008-calendar-read-queries.md
---

## Goal

`indexUsage.integration.test.ts` asserts that every index a range read uses has
`user_id` as its leading column. `getTemplateVersions` fails that assertion
whenever the planner answers its second query — the slots, joined to their
versions — through `schedule_template_id_user_uq`, the `UNIQUE (id, user_id)`
composite-FK target. Both of that index's columns are bound by the join, so the
scan cannot cross tenants, and the rule as coded rejects it anyway. Restate the
rule so it accepts a scan that cannot return another teacher's rows and still
rejects one that can, and make the result independent of which tenant-safe index
the planner picks on the day.

## Acceptance criteria

- [x] `lib/db/queries/indexUsage.integration.test.ts` passes for
      `getTemplateVersions` against a migrated Postgres, in CI and locally.
- [x] The rule the test asserts distinguishes a scan that cannot cross tenants
      from one that can, rather than matching on the index's leading column
      alone. `schedule_template_id_user_uq` is the composite-FK target
      `design/schema.md` §8 introduces so a `template_slot` cannot be attached to
      another user's template, and `templates.ts` joins through both of its
      columns.
- [x] The assertion does not depend on which of several tenant-safe indexes the
      planner chooses. With `enable_seqscan = off` over ~200 fixture rows the
      planner is picking between near-equal index-only scans, and the row counts
      a later ticket adds must not decide whether the suite is green.
- [x] A read that genuinely scans by an index no `user_id` predicate binds still
      fails the test, proven by a case that goes red when the rule is relaxed too
      far. The invariant of `architect-overview.md` §8.4 is not weakened to make
      this one query pass.
- [x] `architect-overview.md` §8.4 and `design/schema.md` §8 agree with what the
      test asserts. If the rule as written in the documents is narrower than the
      one the code needs, the documents change too — the composite FK and the
      `user_id`-led index are two mechanisms for one guarantee, and §8.4 names
      only the second.
- [x] The other seven reads in the suite still pass.

## Notes

**The evidence.** CI run `34356203852` on `main` at `e1f5011`, job
`integration suite`, step `npm run test:integration`:

```
FAIL lib/db/queries/indexUsage.integration.test.ts
  > every read is answerable from an index led by user_id > getTemplateVersions
  expected [ 'semester_year_index_uq', …(13) ] to include 'schedule_template_id_user_uq'
  ❯ lib/db/queries/indexUsage.integration.test.ts:155:31
```

One case of eight; 70 of 71 tests pass. Every step before it — `npm ci`,
`npm run db:migrate`, `scripts/verify-schema.sql` — succeeded, so the schema
under test is the migrated one.

**It is not a flake.** It failed on two consecutive pushes to `main`
(`3d57e3b` and `e1f5011`) and, before those, on `366952f` of
`claude/ticket-t-026-deterministic-ticket-loop`, where it was written off as
unexplained. What varies is the planner's choice for the slots query, which
depends on row counts and statistics, not on the run.

**Where it comes from.** `getTemplateVersions` sends two statements. The first
selects the versions and is filtered by `user_id` directly. The second selects
the slots and joins `template_slot` to `schedule_template` on
`(template_id, user_id) = (id, user_id)`, filtered by `template_slot.user_id`.
The inner side of that join is exactly what `schedule_template_id_user_uq`
exists to serve, and `indexesLedByUserId()` — which reads `pg_index` for indexes
whose `indkey[0]` is `user_id` — does not contain it.

**A leaning, not a decision.** Asserting that every scan is *bound* by `user_id`
— through its own predicate or through every column of a composite FK — says
what §8.4 means, where matching index names says what it happened to produce.
`ANALYZE` after the fixture insert would make the plan stable, but stability is
not the property being asserted, and a test that is green because the planner
was steered is green for the wrong reason.

**Supersedes the unmerged T-028** on `claude/ticket-t-026-deterministic-ticket-loop`,
which asked what the failure was and how to read a CI log. The first question is
answered above. The second is moot: `gh run view --log-failed` returns the log
on this repository — the 403 recorded there was against a run on a branch, and
the output quoted above was read with that command.

**Done.** The rule is restated as binding rather than as the index's leading
column — `ADR-011`, with overview §8.4 and `design/schema.md` §8 changed to name
both mechanisms, and `design/T-008-calendar-read-queries.md` §6 rewritten to what
the test now asserts. The leading-column property is still asserted, as a
property of the DDL read from the catalog for every table carrying `user_id`.

The failing plan is reproducible locally: with `enable_bitmapscan = off` the
planner answers the slots query through `schedule_template_id_user_uq` with
`Index Cond ((id = template_slot.template_id) AND (user_id = <param>))` — the
plan CI failed on, and one the restated rule accepts. Over the eight reads, both
statements each, under fourteen planner configurations (`enable_indexonlyscan`,
`enable_nestloop`, `enable_hashjoin`, `enable_mergejoin`, `enable_bitmapscan`,
`enable_material`/`enable_memoize`, and combinations), 140 plans over eleven
distinct indexes produced no unbound scan and no `Seq Scan` — which is the
third criterion's independence, measured rather than argued. That probe was a
throwaway; what stays in the suite is the rule and the two negative controls.

