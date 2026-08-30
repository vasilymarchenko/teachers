---
id: ADR-001
title: The review tooling reads the project's documents; it does not carry a copy of them
status: accepted
date: 2026-08-30
ticket: T-017
---

## Context

`/ticket` phase 7 carried the review standard as prose: a checklist of the
project's invariants — the `new Date()` and `userId` rules, copy-on-write, the
boundary-date asymmetry — written into the skill. That checklist could not be
reached from a review of a bare pull request, which is how most reviews start.

The obvious fix was to extract the checklist into a shared file that both
`/review` and `/ticket` load. That was built (`rubric.md`), and it failed twice
within a day of being written:

- the `new Date()` check was stated more widely than the rule it cited, and
  would have reported five correct lines in `lib/db/schema` as defects;
- the `DayOverride` check grew a sentence explaining what `architect-overview.md`
  §3.4 says, so a future revision of §3.4 would have left the reviewer asserting
  the old rule to someone who trusted it.

Both are the same failure: a copied rule disagrees with its source the moment
the source changes, and nothing in the copy can detect that. A convention test
guarding the copy's `§` references caught neither — the sections still existed.

The deeper problem is a dependency direction. A checklist inside the tooling
makes `.claude/**` depend on `docs/architecture/**`, so a decision recorded in
the architecture requires an edit to the reviewer, by whoever happens to
remember. The project's own rule — every fact in exactly one place, a detailed
document references the overview rather than restating it — was being enforced
by a tool that violated it.

## Options

**Keep the checklist, guard it with tests.** Cheap to read, fast to run, and the
tests can prove the references resolve. They cannot prove the check still means
what the section means, which is the failure that actually occurred. Rot stays
silent, and it degrades to false confidence rather than to noise.

**Generate the checklist from the documents.** Removes the hand-maintenance, but
requires the architecture document to be machine-parsable — it is Ukrainian
prose that deliberately mixes rules with the reasoning behind them, and marking
it up for a generator would distort the document for the benefit of the tool.

**Read the documents at review time.** One live source of truth, new invariants
covered the day they are written, and a restructure costs nothing. The price is
paid on every review: the reviewer spends the context to read the architecture,
the glossary and the conventions before judging, and the review is only as good
as those documents are clear.

## Decision

The review tooling holds **method only** — what counts as a finding, the
evidence a finding must carry, what to do with one, and how to make the next
review cheaper. It holds no architectural rule, no invariant list, and no
project fact beyond how to find the documentation map.

The standard is the repository's documents, read at review time. `CLAUDE.md`
maps them by type; the reviewer starts there and reads what the map points at
for the code that changed.

A finding must **quote the rule from the document it comes from**. If the
document does not say what the reviewer thought it said, there is no finding.

Consequently: a decision the project makes must never require an edit to the
review tooling. Only a change in the kind of thing being reviewed — another
framework, another database, another language — should.

## Consequences

Every review now reads the documents, so a review costs more context and more
time than checking a list would. That is the price of the guarantee, and it is
why the document-reading pass belongs in a subagent with its own context rather
than in the orchestrator.

Review quality now depends directly on the documents being clear about which of
their statements are normative. `architect-overview.md` mixes rules with
reasoning in continuous prose, so a reviewer reading it cold has to infer which
sentences code can violate. That is a real gap, and the fix belongs in the
document, not in the tooling — T-019.

`rubric.md` and its convention test are deleted rather than shrunk; what
survived of them is the method, now in `.claude/skills/review/SKILL.md`.

Revisit if the read-everything pass becomes too expensive to run on every review
— the response is to narrow *which* documents are read for a given diff, by
teaching the map to route better, never to cache their content back into the
tooling.
