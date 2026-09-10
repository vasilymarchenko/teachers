---
id: ADR-012
title: The local gate and CI keep one check definition, held in step by a test
status: accepted
date: 2026-09-10
ticket: T-029
---

## Context

`ADR-007` made `.github/workflows/ci.yml` the authoritative gate: one workflow,
one definition of what "checked" means, running on every pushed commit. What a
developer — or an agent working a ticket — runs *before* pushing was never
defined anywhere near it. Both skills carried their own chain of commands,
`.claude/skills/teachers-ticket/SKILL.md` and
`.claude/skills/teachers-review/SKILL.md`, and the two had already drifted apart
from the workflow and from each other: `npm run build` and
`scripts/verify-schema.sql` were in `ci.yml` and in neither skill. A change
could therefore be verified locally, reported as checked, and be red in CI —
which costs a round-trip and, worse, teaches everyone that local green means
nothing.

`ADR-001` settled the neighbouring question and constrains this one. The review
skill holds no copy of any architectural rule, because a rule copied into the
tooling disagrees with its source document the first time that document changes,
and no test can tell you it has: a convention test over a copied rule can prove
that a `§` reference still resolves, never that the section still means what the
copy says.

The gate's checks are not that kind of thing, and the difference is what this
decision turns on. A check list is an enumerable set of commands. Set equality
is decidable; "does this prose still mean that prose" is not.

## Options

### 1. `ci.yml` calls the local gate

One definition, drift impossible by construction. It costs everything `ADR-007`
chose the job graph for: the three jobs run in parallel and report three
statuses, `integration` gets its Postgres from a `services:` container the gate
script cannot ask for, and `images` needs buildx set up by an action. Collapsing
them into one script means one status, no parallelism, and a workflow whose
failure mode is "the gate script broke".

### 2. The gate parses `ci.yml` at run time

No copy at all — the workflow becomes the single source and the gate reads it.
It needs a YAML parser, which this project does not have and does not otherwise
want. It also puts a parse failure between the developer and every check: the
measurement refuses to run because the file describing it did not parse, which
is exactly the failure mode `T-029` set out to remove.

### 3. Two definitions, held in step by a convention test

`scripts/gate/checks.ts` states the routing; `scripts/gate/checks.ci.test.ts`
reads both files and fails when they disagree. The precedent is
`lib/db/postgresImage.test.ts`, which already holds one value across three files
by the same method. It costs a hand-maintained list of which jobs are gate jobs.

## Decision

Option 3.

`scripts/gate/checks.ts` is the one place the routing is stated: which checks
exist, which paths pull each one in, and what each needs from the machine.
`npm run gate` runs it. Both skills invoke that command and state no check of
their own.

`scripts/gate/checks.ci.test.ts` holds the list and `ci.yml` level, **scoped to
the three gate jobs** — `checks`, `integration`, `images` — and not to the
workflow as a whole. A future job that runs an npm script for some other purpose
must not have to become a gate check to keep the suite green. `publish` is
already such a job.

The workflow is sliced at its job headers rather than parsed. There is no YAML
parser in this project and this does not justify adding one; slicing costs a few
lines more than matching the whole file, and those lines buy the scoping above,
which a whole-file match cannot express at all.

The two directions are checked differently, because only one of them is
enumerable. Every `npm run <script>` inside a gate job must be a check of that
job, and every check that names an npm script must appear in its job — set
equality, both ways. A step that is not an npm script is arbitrary shell, so a
check that covers one names a substring that identifies it, and the test asserts
that substring is still there.

This does not reopen `ADR-001`. What is duplicated here is a list of commands,
not a rule expressed in prose, and the mechanism `ADR-001` rejected for rules is
the right one for a set.

## Consequences

A check with no CI counterpart is allowed and is visible as such — it carries no
job. `hygiene` is the only one: what it looks for are properties of a *diff*,
and CI checks out a commit rather than reviewing one.

The reverse gap is real and is not closed: a new *gate* job added to `ci.yml`
has to be added to the test's three-name list by hand, and until it is, the test
passes while ignoring it. The list is three lines in one file and changes about
as often as `ADR-007` does.

A check the local machine cannot run — no Docker daemon, no `DATABASE_URL` — is
reported `skipped` with the reason and never as a pass, which is what keeps the
two definitions honest rather than merely equal. It also means local green is a
weaker statement than CI green, deliberately: `gh pr checks` on the pushed head
stays the last word.

`npm run build` now runs on every gate invocation, including inside a review.
That is the point — it is the check whose absence made local green misleading —
and it is the slowest one. If the cost becomes the reason people stop running
the gate, the answer is to route `build` by path like the others, which is a
change to `checks.ts` **and** to this test at the same time, and that is the
property worth having.

Revisit if a YAML parser enters the project for another reason, in which case
option 2's objection weakens; or if the migrator smoke test is unified into one
script called by both CI and the gate (`T-030`), which would make part of option
1 true for one job without collapsing the others.
