---
id: ADR-015
title: A review is scoped to the change under review, and its breadth is an argument
status: accepted
date: 2026-09-11
ticket: T-033
---

## Context

`/teachers-review` ran one breadth on every invocation. Phase 2 read the
documents the map pointed at for the change; phase 4 invoked `/code-review` at a
fixed level with no scope, so the generic pass read whatever it judged relevant
and reported findings from files the diff does not touch. Every invocation cost
the same whether it was a deliberate review of a large pull request or the third
round of a self-review loop re-reading a branch it had already read twice.

The measured case is session `4c401314`, the `/teachers-ticket T-021` run. Round
3 of its review loop cost 31.6% of the session and returned no finding inside
the pull request: three of its five findings were in `scripts/gate/**`, already
merged on `main` and untouched by the diff. The `/code-review` fork for that
round alone was 9.46M tokens, roughly double either of the two rounds before it.
The loop had to dispose of findings about code the branch could not fix without
widening itself.

`ADR-001` anticipated this. It settled that the review tooling reads the
documents at review time rather than carrying a copy of them, and named the
condition for revisiting: *"if the read-everything pass becomes too expensive to
run on every review — the response is to narrow which documents are read for a
given diff, by teaching the map to route better, never to cache their content
back into the tooling."* That is the condition being exercised here, and the
response it prescribes is the one taken.

Phase 3 carried a second cost. It ran `npm run gate` unconditionally, including
where `ci.yml` had already run the same checks on the same head, on a machine
with the Docker daemon and the database this one often lacks. The rule that
forced it was written as a rule about *whose* gate may be trusted — a row in
someone else's ledger was not evidence — because that is how the bug `T-017`
found presented: a gate run against the caller's tree, read as a verdict on the
target.

## Options

**Leave the breadth fixed and shorten the loop instead.** Cheapest: no argument
to document, no second vocabulary, and `T-034`'s exit criterion already stops the
loop at the first round with no finding inside the diff. It does nothing for the
rounds that do run, nor for a deliberate standalone review of a two-line change,
which would still read the architecture end to end. It also leaves the
out-of-diff findings, which are the part that wasted the measured round.

**Invent a scope vocabulary of this skill's own** — a `--depth`, a `--quick`, a
named set of profiles. It would fit the phases exactly, since this skill has
phases `/code-review` does not. It costs a second set of words for one thing:
the caller who types `--depth 2` here and `high` there has to hold both, and the
day `/code-review` changes what its levels buy, nothing connects the two.

**Borrow `/code-review`'s argument and its four levels, and scope the passes to
the diff.** One word means one thing in both skills, and the sentence stating
what each level buys can be quoted from `/code-review` with attribution, so a
change there makes this file detectably wrong rather than quietly contradicted.
The cost is a dependency on another skill's vocabulary, which can change without
notice, and a table that must map four levels onto phases `/code-review` has no
idea exist.

**For phase 3: state the rule as the head and the tree, not as the command.**
The alternative is to keep running the gate unconditionally, which is honest and
expensive and reports `skipped` for the checks that matter most on a machine
without Docker. Restating the rule costs precision — it has to be right, because
stated loosely it reinstates exactly the `T-017` bug.

## Decision

**`--effort low|medium|high|max` is an argument of `/teachers-review`**, resolved
in phase 1 beside `--merge` and `--comment`, defaulting to `high` in review mode,
and set by the caller in self-review mode. The name and the four levels are
`/code-review`'s, unchanged. One table in the skill maps a level to what runs —
the level passed through, how far phase 2's reading extends, and whether phase 6
runs — and no level is named anywhere else in that file, so the table cannot be
contradicted from elsewhere in it.

**The self-review level is stated in exactly one file.**
`.claude/skills/teachers-ticket/SKILL.md` states it, on the line that invokes the
review; `/teachers-review` references the caller and states no self-review value.

**Both passes are scoped to the change.** Phase 2 derives the documents it reads
from the paths the diff touches; phase 4 passes `/code-review` the resolved
target *and* those paths. A finding whose `file:line` lies outside the diff is
not a finding of this review and owes the caller no disposition — except a
security or data-correctness defect, which is named in a separate
`## Outside this change` section that nothing in the review's verdict or the
caller's loop turns on.

**Phase 3 establishes a verdict rather than always producing one**: on a pull
request, what `ci.yml` reported on the head under review (`ADR-007`); in
self-review, the `.gate/ledger.jsonl` row for that head; on a branch or working
tree, `npm run gate`, because nothing else has. The local gate still runs
wherever no verdict on this exact head exists, is pending, or cannot be read.
What the guarantee turns on is **the head and the tree the verdict was produced
against, not which command produced it**: a verdict from a different head or a
dirty tree is not evidence, whether it came from CI, from the ledger or from a
local run. Where no verdict can be established, the report says so — never that
it passed.

**No document content is cached into the tooling.** `ADR-001` holds unchanged:
what narrows is which documents a given diff reaches, derived from its paths at
review time. A copy of a rule in `.claude/**` is still the thing that decision
forbids, and this one adds none.

## Consequences

A review now costs what the change is worth rather than what the repository is
worth, and a self-review round can be bought cheaply enough to run without
thinking about it — which is what lets `T-034` set a round's level below the
standalone default.

**What a narrowed review no longer catches: a defect the change causes in a file
it does not touch.** A changed function signature whose only other caller is
outside the diff, a removed invariant some untouched module relied on, a
migration that breaks a query nobody edited. Three things bound that loss and
none of them closes it. The `max` row reads the code the diff depends on but
does not change, so a deliberate review can still reach outward. The
`## Outside this change` section keeps the severe classes visible even under a
narrow level. And the gate — `ADR-012`'s one check definition — type-checks,
lints, tests and builds the whole repository on every run, which is where a
broken caller outside the diff is most likely to surface anyway. What is
genuinely given up is the reviewer's *judgement* applied to untouched code, and
it is given up deliberately: the measured round spent a third of a session
applying it and found nothing that the pull request could act on.

Reading a verdict instead of producing one makes the review cheaper and, on a
pull request, more truthful — `ci.yml` runs the checks this machine reports as
`skipped`. It also makes the head-and-tree comparison load-bearing. Stated
wrongly, or checked lazily, it reinstates the `T-017` bug with a better excuse
than the original had. `.gate/ledger.jsonl` carries `commit` and `dirty` per row
so the comparison is mechanical rather than remembered.

The dependency on `/code-review`'s vocabulary is real and deliberately visible:
what the levels buy is quoted with attribution, so the failure mode is a
detectably wrong sentence rather than a silent divergence.

Revisit if the out-of-diff drop starts hiding real defects — the evidence would
be a defect reaching `main` that a round actually named and dropped, which the
`## Outside this change` section makes visible in a report rather than losing.
The response then is a wider scope rule, not a wider effort level: the level
buys reading, and reading was never what was missing.
