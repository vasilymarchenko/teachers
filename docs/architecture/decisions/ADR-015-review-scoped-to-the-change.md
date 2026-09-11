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

`ADR-014`, accepted the same day, states that `/teachers-review` "reports
findings, proposes in phase 6, and edits nothing", and rests part of its case for
extracting the fix loop on that phase existing. Gating phase 6 by effort level
narrows when it runs without removing it, so that decision is not superseded and
`ADR-014`'s Decision still describes this skill — but the concession below, that
the phase then runs in no invocation the repository makes by default, is a cost
`ADR-014` did not anticipate, and it is named here rather than left to be
discovered from the two records together.

`ADR-001` anticipated this. It settled that the review tooling reads the
documents at review time rather than carrying a copy of them, and named the
condition for revisiting: *"if the read-everything pass becomes too expensive to
run on every review — the response is to narrow which documents are read for a
given diff, by teaching the map to route better, never to cache their content
back into the tooling."* That is the condition being exercised here, and the
response it prescribes is the one taken.

`T-029` settled the opposite of what this record settles for phase 3. Its text
holds that `/teachers-review` keeps its own gate run because "a caller's ledger
row would reinstate it the first time it was written against a different tree",
and one of its ticked criteria reads that `/teachers-ticket` phase 6 and
`/teachers-review` phase 3 both invoke the gate. That is the decision being
reversed here, and `T-029`'s `## Notes` now points forward to this record so a
reader landing there is not handed the superseded rule. What `T-029` got right is
kept: the guarantee is real, and this record replaces the reason given for it,
not the guarantee.

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
and set by the caller in self-review mode. The four **level names** are
`/code-review`'s, unchanged; the flag is not, because `/code-review` takes its
level as a bare positional word and this skill has three other arguments a bare
word could not be distinguished from. Its fifth level, `ultra`, is deliberately
not offered: it is a user-triggered, billed cloud review the skill cannot launch
on a user's behalf. One table in the skill maps a level to what runs — the level
passed through, how far phase 2's reading extends, and whether phase 6 runs — and
**no phase below that table names a level**, so no phase can contradict it. The
two places a level appears besides the table are the argument row above it and
the frontmatter `description`, both required by the ticket so that a caller
reading the skill list sees what the argument does.

**The self-review level is stated in exactly one file.**
`.claude/skills/teachers-ticket/SKILL.md` states it, on the line that invokes the
review; `/teachers-review` references the caller and states no self-review value.

**Both passes are scoped to the change.** Phase 2 derives the documents it reads
from the paths the diff touches; phase 4 passes `/code-review` the resolved
target *and* those paths, and that argument is a saving rather than a guarantee,
because a path in `/code-review`'s grammar is a target and not a filter over one.

**What enforces the scope is a causation test, not a line-number test.** A
finding the change did not cause is not a finding of this review and owes the
caller no disposition; a `file:line` outside the diff is how that is nearly
always read. The one place the two part company is a file the change obliged to
update and did not — a backlog row against the frontmatter it mirrors, an index
against the file it lists, the glossary against a term the change introduces.
That defect's `file:line` is outside the diff and the change caused it, so it is
reported like any other finding. A location test would drop exactly those, which
are the whole lens of the contract pass and one line each for the author to fix;
`T-033`'s criterion is written as a location test and this is the reading taken,
recorded in that ticket's `## Notes`.

A security or data-correctness defect the change did **not** cause is the
remaining exception: named in a separate `## Outside this change` section that
nothing in the review's verdict or the caller's loop turns on, and routed to the
reader rather than to a phase that may not run.

**Phase 3 establishes a verdict rather than always producing one**, by a rule
that resolves in precedence order: on a pull request, what `ci.yml` reported on
the head under review (`ADR-007`); where that is not readable yet,
`.gate/last-run.json`, read as a whole run rather than as rows selected by hand
out of the append-only ledger, which carries both the failing and the passing
row for a head that was gated twice; on a branch or working tree,
`npm run gate`, because nothing else has. The local gate still runs wherever no
verdict on this exact head exists, is pending, or cannot be read.

Self-review is not a fourth case in that rule. It is a pull request, and it is
the second row's usual one, because the caller has just pushed and CI has not
finished — which is what `T-033`'s criterion means by "in self-review, the
ledger row". Stating it as a *mode* would make the ledger row outrank a finished
CI run on the same head, and `ADR-007` makes that run the authoritative gate; a
rule cannot borrow CI's authority for the cheap path and then override it. The
reading is recorded in `T-033`'s `## Notes`.

What the guarantee turns on is **the head and the tree the verdict was produced
against, not which command produced it**: a verdict from a different head or a
dirty tree is not evidence, whether it came from CI, from the ledger or from a
local run. Where no verdict can be established, the report says so — never that
it passed.

**A merge rests on `ci.yml` alone.** Phase 3's fallbacks make a review possible
where CI cannot be read; they do not make a merge safe. A local verdict lives in
a gitignored file on one machine and skips the checks that machine cannot run,
so `--merge` requires the authoritative gate's own verdict on the head being
merged and nothing weaker.

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

**Phase 6 now runs in no invocation this repository actually makes.** It is
gated on the widest level; review mode defaults one below it and
`/teachers-ticket` passes one below it, so promoting a recurring check into a
lint rule or a convention test is reachable only by a hand-typed level. That is
a real loss and it is taken knowingly: a proposal drawn from a pass that read
two directories has no evidence under it, and this repository has another route
to the same place — a ticket filed by hand, which is what `T-027` is. Revisit if
a quarter passes with no check promoted, because the phase existing and never
running is worse than either alternative.

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
