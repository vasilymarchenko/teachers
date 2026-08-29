-- Custom migration (`docs/architecture/design/schema.md` §9).
--
-- `drizzle-kit` cannot express an `EXCLUDE` constraint, so the three of them are
-- written by hand here, after 0001 has created the tables and 0000 the
-- `btree_gist` operator classes they need.
--
-- These statements are invisible to the snapshot in `drizzle/meta`. A future
-- generated migration that drops or recreates one of these tables would take
-- its exclusion constraint with it, and it would have to be re-added by hand —
-- invariant I3 is not something the snapshot will notice going missing.

-- Two academic years of one teacher may not overlap: `boundaries.ts` resolves
-- END_OF_SEMESTER and NEXT_BREAK by asking which year and semester a date falls
-- in, and two overlapping years make that question have two answers.
-- `daterange(a, b, '[]')` because an entity range's `date_to` is inclusive.
ALTER TABLE "academic_year"
  ADD CONSTRAINT "academic_year_no_overlap_ex" EXCLUDE USING gist (
    "user_id" WITH =,
    daterange("date_from", "date_to", '[]') WITH &&
  );
--> statement-breakpoint
ALTER TABLE "semester"
  ADD CONSTRAINT "semester_no_overlap_ex" EXCLUDE USING gist (
    "user_id" WITH =,
    daterange("date_from", "date_to", '[]') WITH &&
  );
--> statement-breakpoint
-- Invariant I3 of `architect-overview.md` §3.2: two versions of the weekly
-- template for the same (user, view) may not be in force on the same day.
-- The two-argument `daterange` is IMMUTABLE and defaults to '[)', which is
-- exactly the half-open interval `[valid_from, valid_to)` the model uses.
--
-- Its GiST index on (user_id, view, daterange(...)) starts with `user_id` and
-- answers the only lookup there is — the version covering a date — so
-- `schedule_template` needs no second index (overview §8.4).
ALTER TABLE "schedule_template"
  ADD CONSTRAINT "schedule_template_no_overlap_ex" EXCLUDE USING gist (
    "user_id" WITH =,
    "view" WITH =,
    daterange("valid_from", "valid_to") WITH &&
  );
