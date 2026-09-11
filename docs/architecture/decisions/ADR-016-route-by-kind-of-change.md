---
id: ADR-016
title: Route the gate and the review by the kind of change, and declare the one place that diverges from CI
status: accepted
date: 2026-09-11
ticket: T-037
---

## Context

`ADR-012` put the gate's routing in one place, `scripts/gate/checks.ts`, and
held it level with `.github/workflows/ci.yml` by a test. The routing it states
has one dimension: the paths a change touches decide which *extra* checks it
pulls in. Four checks are unconditional — `lint`, `typecheck`, `test` and
`build` — and so is `hygiene`.

That was written for a repository whose changes were code. A large share of them
are not. `docs/**`, the root `CLAUDE.md`, `.claude/skills/**` and
`docs/architecture/decisions/**` are edited by nearly every ticket and by a
class of change that edits nothing else — a backlog status, an ADR, a skill's
method. Such a diff pays for `npm test` and a full `next build` to be told what
the previous run already established, because `next build` compiles no document
and the unit suite reads `lib/**`, `app/**`, `components/**` and `scripts/**`.

`ADR-012` anticipated this in its own consequences: *"If the cost becomes the
reason people stop running the gate, the answer is to route `build` by path like
the others, which is a change to `checks.ts` **and** to this test at the same
time."* What a full loop costs on a change is what `T-034` sets out to measure;
this decision is about not paying it where it buys nothing.

The review has the same shape of waste and a sharper version of it. `/code-review`
reads a diff for correctness, reuse, simplification and efficiency defects. Given
prose it produces prose opinions, which are not what it is trusted for, and the
pass that *is* the whole subject of a documentation change — the ticket against
the documents — is the one it cannot do.

What constrains the answer is that `ci.yml` runs its `checks` job on every push,
with no path filter on the trigger. A filter added to `checks.ts` alone makes
the two definitions disagree — the exact thing `ADR-012` exists to prevent.

## Options

### 1. Leave it. One definition, no divergence

Free, and it keeps `ADR-012` literally true. It costs every documentation change
several minutes of `next build` for an answer that cannot differ, and a
`/code-review` pass whose output the reader learns to discard — which is how a
gate stops being run at all.

### 2. Put the same filter on `ci.yml`

`paths-ignore:` on the push trigger, so neither definition runs `test` and
`build` for a diff of prose. Genuinely one definition, no divergence to declare.

It costs the property `ADR-007` rests on: a status attaches to a commit, and a
commit whose workflow did not run has no status. Under branch protection
(`T-025`) a required check that never ran blocks the merge rather than passing
it, so every documentation pull request would need a manual override — and the
first thing an override teaches is that the gate is optional. It also means a
`.md`-only diff that breaks `scripts/gate/skills.test.ts` (which reads
`.claude/skills/**`) is checked by nothing anywhere.

### 3. Route in the gate, declare the divergence in the parity test

`checks.ts` gains a second dimension, `kinds`, beside `paths`. `test` and
`build` carry `kinds: ["code"]`. `ci.yml` is untouched and keeps running them on
every push. `checks.ci.test.ts` gains a block that names every kind-routed check
and asserts the property that makes the routing safe — no path filter on the
push trigger, no `if:` on the `checks` job.

It costs a real asymmetry: local green is now a weaker statement for a
documentation change than for a code change. `ADR-012` already made local green
weaker than CI green on purpose, so this is a difference of degree.

## Decision

Option 3.

**The kind of change is derived from the paths and nothing else.**
`changeKind()` in `scripts/gate/checks.ts` is the one definition of it. A file
is prose when its path ends in `.md` or sits under `docs/`; every other path —
a hook script, a JSON setting, a workflow — is code, because the suite reads
several such files. A diff carrying one code file is a `code` change however
much prose is beside it, and an empty file list is `code`, because the
conservative answer for a diff that could not be resolved is the one that checks
more.

**Classification is by what the diff contains, never by which part of it the
reader means to look at.** That sentence is the whole rule, and it is what stops
the routing from becoming a judgement call in either tool.

**A routed-away check is reported, never dropped.** It appears in the table, in
`.gate/last-run.json` and in the pull request body as `skipped`, with a reason
naming the `ci.yml` job that ran it. A skip is not a pass — the gate's existing
rule, unchanged, and the reason is what lets a reader see that the check was run
somewhere rather than nowhere.

**`hygiene` runs on every kind.** Its three checks are properties of a diff, not
of the source tree, so a diff of prose can carry every one of them.

**`/teachers-review` takes the same dimension.** Its phase 1 table states which
passes each kind runs; a documentation change runs the contract pass and the
reviewer's own reading, and not `/code-review`. The table states the passes and
the skill states no path rule of its own: the classification is `changeKind()`,
in code, where the gate reads it too.

**`ci.yml` keeps no filter.** Its push trigger stays `branches: ["**"]` with no
`paths:` or `paths-ignore:`, and the `checks` job carries no `if:`. Those two
facts are asserted by `scripts/gate/checks.ci.test.ts`, because the gate's skip
reason is a statement about them.

## Consequences

`ADR-012`'s guarantee survives in the form that matters: the two definitions
still hold the same set of checks, set-equal in both directions, and the one
place they differ is named in the test rather than discovered by someone whose
pull request went red. What is no longer true is that the gate runs everything
CI runs on every change; what is true instead is that everything the gate routes
away is run by CI before the change can merge, and the test is what keeps that
true.

The cost lands on one case and is worth naming precisely: a `.md`-only change
that breaks a convention test — `scripts/gate/skills.test.ts` today, the backlog
contract tests `T-027` adds next — is now red in CI rather than red locally. The
author learns it a push later. That is the price of the routing, and it is
bounded by the checks being run at all.

Revisit if that case stops being rare. The fix needs no new decision: convention
tests over prose have their own paths, so a third kind — or a `paths` entry
pulling `test` back in for `.claude/**` and `docs/backlog/**` — states itself in
`changeKind()` and in the block this ADR added to the parity test. Revisit also
if branch protection (`T-025`) makes `checks` a required status, which is what
option 2 would have broken and what makes option 3 strictly better than it.
