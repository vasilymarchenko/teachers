# What a ticket run costs, measured

**Ticket:** `docs/backlog/T-034-bound-the-ticket-loop-context.md`
**Status:** authoritative for T-034's measurements.

Rationale lives in `docs/architecture/decisions/ADR-017-a-run-keeps-its-state-outside-its-context.md`.
This document adds no reasoning: it states how the numbers are taken, the
baseline they were taken from, and what the same measurement says about a run
worked with the reworked skill.

## How a measurement is taken

```sh
npm run cost -- <session-id | path/to/transcript.jsonl> [--json]
```

`scripts/cost/transcript-cost.ts` reads the transcript the CLI writes —
`~/.claude/projects/<project-slug>/<session-id>.jsonl`, one JSON object per
line — and reports, per phase and in total:

| Column | What it is |
|---|---|
| `calls` | API calls. One `usage` on an `assistant` entry is one call. |
| `sub` | how many of them were made inside a subagent (`isSidechain`). |
| `input` | fresh input tokens: what a call sent that no earlier call had sent. |
| `cache w` | `cache_creation_input_tokens` — written into the cache by this call. |
| `cache r` | `cache_read_input_tokens` — the re-sent context, charged again on every call. |
| `output` | `output_tokens`. |
| `ctx min/med/max` | the context each call carried: the three input classes together. |

**Phase attribution** comes from two markers, in that order of trust: the
`"phase": N` a run writes into `.gate/run.json` at each boundary, which is the
reason the state file is the primary marker; and, failing that, the phase the
assistant named in its own prose. A subagent's prose never moves the caller's
phase — it is reading the same skill file and names phases the caller is not in
— so a subagent's calls are attributed to the phase that launched it. A
transcript with no marker at all reports one `—` row and says so.

`scripts/cost/transcript-cost.test.ts` covers the parsing over synthetic lines;
a real transcript is the one input a CI runner does not have.

## The baseline — session `4c401314`, the `/teachers-ticket T-021` run

Taken from that session's transcript before any of T-034's changes existed:

| | |
|---|---|
| API calls | 535 |
| cache-read tokens | 58.85M |
| fresh input tokens | 1,070 |
| context, first call → last | 67K → 244K, with no reset |
| phase 7's share of the run | 71.8% |
| tool calls in the main session | 141, every one of them alone in its message |
| subagents | 6, ~40% of the cost; the widest (the round-3 `/code-review` fork) reached ~113K of its own |

Two readings of that table drive the decisions in `ADR-017`. The ratio of
cache-read to fresh input — 55,000:1 — is the shape of a context that is
re-sent whole on every call and never reset. And the subagent line is why the
boundary at phase 7 is specified by *what crosses it* rather than by the fact
that it is a subagent: six of them cost 40% of the run precisely because they
were handed large inputs.

## After the rework

**Outstanding.** The second half of T-034's measurement criterion is one real
ticket worked end to end with the reworked skill, measured the same way and
recorded here beside the baseline. The change that adds the state file, the
round subagent and the extracted loop cannot itself produce that number: it was
not worked as a `/teachers-ticket` run, and a run of the old skill would measure
the thing being replaced.

What exists so far is the instrument, run against the session that wrote it —
a direct change, not a ticket run, so its phase rows come from prose markers and
not from a state file:

```
phase  calls  sub  input  cache w  cache r  output  ctx min  ctx med  ctx max
─────  ─────  ───  ─────  ───────  ───────  ──────  ───────  ───────  ───────
—         46    0     92   148.0K    4.27M   31.8K    65.8K   100.5K   121.9K
1          2    0      4     6964   253.7K    2305   128.9K   130.3K   131.8K
5          3    0      6     8495   367.1K    5031   121.9K   124.8K   128.9K
6         17    0     34    28.9K    2.35M   21.4K   131.8K   141.5K   147.6K
all       68    0    136   192.3K    7.24M   60.5K    65.8K            147.6K
```

It reproduces the baseline's shape at a smaller scale — 7.24M cache-read against
136 fresh input tokens — which is what the instrument had to show to be worth
trusting on a run that matters.

**Fill this section from the first `/teachers-ticket` run worked with the
reworked skill**: the table above for that session, the phase-7 share beside the
baseline's 71.8%, and how many of its calls carried more than one tool use. If
those numbers do not move materially, `ADR-017`'s revisit condition has fired
and the boundaries are in the wrong place.
