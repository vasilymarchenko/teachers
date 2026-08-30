---
id: T-017
type: ticket
title: Review skill and the shared review rubric
status: done
depends_on: []
refs:
  - .claude/skills/ticket/SKILL.md
  - CLAUDE.md
  - docs/backlog/CLAUDE.md
  - docs/architecture/architect-overview.md §9
  - docs/architecture/architect-overview.md §10
---

## Goal

Make a review of a raised PR as strong as phase 7 of `/ticket`, and make both
run off one copy of the standard. The standard is currently prose inside
`.claude/skills/ticket/SKILL.md` phase 7: it cannot be reached from a bare PR
review, and a second copy of it would drift from the first. Extract it into a
rubric that a new `/review` skill and `/ticket` phase 7 both load.

This ticket is tooling, not product code — the first item in this backlog that
changes `.claude/` rather than the application. It is listed first among the
`todo` tickets because every ticket after it is reviewed by what it builds.

## Acceptance criteria

- [x] `.claude/skills/review/references/rubric.md` holds the review standard as
      the single copy: the checks from `/ticket` phase 7, each phrased as a
      question with the `§` or `CLAUDE.md` rule it comes from. It states no
      reasoning of its own and restates no section it references — a check reads
      "§3.2 I1 — does any path UPDATE a `ScheduleTemplate` row whose `validFrom`
      is before `today()`?", not a retelling of copy-on-write.
- [x] The rubric names the invariants that are easy to break silently and that a
      general-purpose reviewer cannot know: the `new Date()` and `userId` rules
      (root `CLAUDE.md`, overview §8.4, §8.5), copy-on-write I1–I3 (§3.2),
      `boundaryDate` exclusive against the inclusive `dateTo` of `AcademicYear`,
      `Semester`, `NonTeachingPeriod` and `Event` (§8.1), `DayOverride`
      surviving a non-teaching day and `replacedOriginal` being absent rather
      than `null` (§3.4), language by audience, and a domain term missing from
      `glossary.md`.
- [x] The rubric tells a reviewer that §9's accepted compromises and §10's
      current defaults are decisions, not findings: code implementing them is
      correct, and the reportable finding is a §9 trigger having been reached —
      not a proposal to materialise `expand()`, add a server-side PDF renderer
      or normalise the free-text reference values.
- [x] A finding is reportable only with `file:line`, the rule it violates (a `§`,
      an acceptance criterion, or a named stack fact) and a concrete failure
      scenario — inputs or state, then the wrong output. A finding that cannot
      state one is dropped rather than softened; the format lives with the
      rubric.
- [x] A `review-contract` agent under `.claude/agents/` checks the diff against
      the ticket and the documents: every acceptance criterion against the code
      or test that satisfies it, backlog frontmatter against the `README.md` row
      that mirrors it, the glossary, the language rules, and a persisted
      `docs/architecture/design/` document against what was actually built.
- [x] A `/review` skill reviews a PR (`/review 12`), a branch, or the working
      tree. It runs the mechanical gate first — `lint`, `typecheck`, `test`, and
      `test:integration` when `lib/db` is touched — then the `review-contract`
      agent and the built-in `/code-review`, and reports the merged findings
      ranked. It never rewrites the generic correctness pass that
      `/code-review` already provides.
- [x] `/review` finds the ticket id from the branch name
      (`claude/ticket-t-NNN-*`) or the PR title, so a bare `/review 12` still
      gets the contract check, and says so plainly when it cannot find one.
- [x] `/ticket` phase 7 invokes `/review` in self-review mode instead of
      restating the checks, and phase 4 reads the rubric so code is planned
      against the standard it will be judged by. No check exists in two files.
- [x] `.claude/**` is English throughout, like the rest of the developer-facing
      tree (root `CLAUDE.md`).

## Notes

Deliberately out of scope, to be added once real reviews show which checks
actually fire: the `review-invariants` and `review-stack` agents from the same
design (project decisions and Next.js/Drizzle/better-auth failure modes as
separate lenses), and a verification pass that tries to disprove a finding
before reporting it. The first cut is the rubric, the contract agent and the
skill.

The rubric is expected to shrink. A check that fires twice belongs in a lint
rule or a convention test — the pattern `lib/auth/queryDiscipline.test.ts`
already sets — not in a reviewer's checklist. `new Date()` outside `lib/time`
is the first candidate: it is enforced today only by prose.

Built beyond the criteria: `.claude/skills/review/references/rubric.test.ts`,
which asserts that every `§` and every path the rubric cites still resolves. The
rubric's whole design is references rather than restatements, so a renumbered
section turns a check into a pointer at nothing and its own text does not say
so. It needed one `include` entry in `vitest.config.mts` — the default glob does
not match dot-directories. It caught two errors on its first run.

The invariant list in `/ticket` phase 5 was replaced by a pointer to the rubric
as well, not only phase 7's: the same rules stated at implementation time and at
review time are the same two copies the ticket set out to remove.

The review it built found six things in it, all fixed in the review commit. Two
are worth carrying forward. The rubric had grown an explanation in its own §3.4
check — the failure the file is written to prevent, appearing in the first draft
of the file — so the check now asks the question and names the section instead of
answering it. And `.claude/**` was cited as English "per root `CLAUDE.md`" when
the root document's list did not mention it; the list now does. `/review` also
learned what to do when a just-added agent has not registered yet, which is how
the contract pass ran here.
