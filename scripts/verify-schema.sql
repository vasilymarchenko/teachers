-- Asserts that a database has actually been migrated.
--
-- `drizzle-kit migrate` reports success loudly, but the two things this project
-- depends on most are the two that can go missing quietly: the `btree_gist`
-- extension of `drizzle/0000_btree_gist.sql`, and the three `EXCLUDE USING
-- gist` constraints of `drizzle/0002_exclusion_constraints.sql`, which are hand
-- written and therefore invisible to the snapshot in `drizzle/meta`. A database
-- missing either still accepts every INSERT the integration suite makes — it
-- just stops rejecting the overlaps the suite exists to prove are rejected.
--
-- CI runs this between `db:migrate` and the integration suite, and again after
-- the migrator image has migrated a throwaway database (T-024). Run it by hand
-- with:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verify-schema.sql
--
-- `ON_ERROR_STOP=1` is what turns a raised exception into a non-zero exit; the
-- \set below is the same switch for a psql invoked without the flag.

\set ON_ERROR_STOP on

DO $$
DECLARE
  -- Invariant I3 and its two siblings — `architect-overview.md` §3.2,
  -- `design/schema.md` §4.7. Named here so a renamed constraint fails this
  -- check rather than passing it by not being looked for.
  expected_exclusions text[] := ARRAY[
    'academic_year_no_overlap_ex',
    'semester_no_overlap_ex',
    'schedule_template_no_overlap_ex'
  ];
  -- One table per aggregate of `design/schema.md` §4, plus better-auth's four.
  expected_tables text[] := ARRAY[
    'academic_year', 'account', 'bell_schedule', 'day_override', 'event',
    'non_teaching_period', 'non_teaching_weekday_rule', 'parity_anchor',
    'schedule_template', 'semester', 'session', 'template_slot', 'user',
    'verification'
  ];
  missing text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    RAISE EXCEPTION
      'btree_gist is not installed. The exclusion constraints cannot exist '
      'without it, so 0000_btree_gist.sql did not run — or ran as a role '
      'without CREATE on the database.';
  END IF;

  SELECT array_agg(t ORDER BY t) INTO missing
  FROM unnest(expected_tables) AS t
  WHERE to_regclass(quote_ident(t)) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'migrated schema is incomplete — missing table(s): %',
      array_to_string(missing, ', ');
  END IF;

  SELECT array_agg(c ORDER BY c) INTO missing
  FROM unnest(expected_exclusions) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = c AND contype = 'x'
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'missing EXCLUDE constraint(s): %. 0002_exclusion_constraints.sql is a '
      'hand-written migration the drizzle snapshot does not track, so a '
      'regenerated migration can drop one without noticing.',
      array_to_string(missing, ', ');
  END IF;

  RAISE NOTICE 'schema verified: btree_gist, % tables, % exclusion constraints.',
    array_length(expected_tables, 1), array_length(expected_exclusions, 1);
END $$;
