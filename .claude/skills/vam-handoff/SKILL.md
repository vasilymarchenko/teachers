---
name: vam-handoff
description: Compact the current conversation into a handoff document so a fresh session, a different agent, or a teammate can pick up the work without losing context. Use this whenever the user asks to hand off, wrap up, "write this up for next time", save or dump the context, prepare a continuation doc, brief another agent, or mentions they're running low on context or about to start a fresh chat — including when they invoke /vam-handoff. Do not use it for summarizing an external document or article the user just gave you; this is for the conversation itself.
---

# Handoff

Write a handoff document that lets a fresh agent continue this work at close to full speed, without the current conversation.

The failure mode to avoid is a transcript. Nobody needs to know the order in which things were discussed. What the next session needs is the current state of the world, the reasoning behind it, and the shortest path back to productive work. Aim for a document someone could read in two minutes and then act on.

## Before you write

Scan the whole conversation and pull out:

- **The actual goal**, including how it changed. If the user started with "add caching" and ended up rewriting the query layer, the goal is the query layer.
- **Decisions and their rationale.** A decision without its reason gets re-litigated in the next session. "Chose Postgres over SQLite because the deploy target is multi-instance" survives; "using Postgres" does not.
- **Dead ends.** Things tried that failed, approaches ruled out, and why. This is often the highest-value section — it's the part the next agent cannot rediscover cheaply and will otherwise waste a turn repeating.
- **Constraints and preferences** the user stated: versions, deadlines, style rules, tools they won't use, things they've asked you to stop doing.
- **Exact details that resist paraphrase**: file paths, commands that worked, error messages, version numbers, IDs, function and table names, numbers the user cares about.
- **Open threads**: unanswered questions, unverified assumptions, work that's half-done.

If the user said what the next session is for (via an argument or in their message), treat that as a filter. Lead with what's relevant to that focus, compress or drop the rest, and say what you dropped in one line so nothing disappears silently.

## Don't duplicate other artifacts

If content already lives in a spec, plan, ADR, issue, commit, diff, or file you created, reference it by path or URL instead of restating it. The handoff's job is to point at those and explain what matters about them — which parts are settled, which are stale, what to read first.

## Be honest about certainty

Mark unverified things as unverified. Do not promote a guess made mid-conversation into a stated fact, and do not invent detail to make a section look complete. An empty "Open questions" section is fine; a fabricated one costs the next session real time.

## Redact

Strip API keys, tokens, passwords, connection strings with credentials, and personal information. Reference them by name and location instead: "DB password is in `.env` as `PG_PASSWORD`".

## Structure

Use this template. Drop sections that would be empty rather than padding them.

```markdown
# Handoff: <short topic>

**Date:** <date> · **Next session focus:** <the stated focus, or "open">

## TL;DR
Three or four sentences: what this work is, where it stands, what to do next.

## Goal and constraints
What we're trying to achieve, plus hard constraints (versions, deadlines, must-nots)
and the user's stated preferences.

## Current state
What exists right now and whether it works. Be concrete about what's verified
versus assumed.

## Key decisions
- **<decision>** — <why>. <any tradeoff accepted>

## Ruled out
- **<approach>** — <what happened / why it was rejected>

## Open questions and blockers
- <question, and who or what can resolve it>

## Artifacts and references
- `path/or/url` — what it is, and what to read it for

## Next steps
1. <concrete first action>
2. ...

## Suggested skills
Skills the next agent should invoke, and when.
```

## Where to save it

Write the document to a file, and tell the user the exact path.

- **Claude Code / terminal:** save to `.personal/handoffs/handoff-<topic>-<date>.md` at the repository root. Create `.personal/handoffs/` if it doesn't exist. Do not use `~/.claude` — that's Claude Code's config directory, and a handoff belongs beside the code it describes.

  `.personal/` is meant to stay local, so check that it's ignored: if the repo has a `.gitignore` (or `.git/info/exclude`) without a `.personal` entry, say so and offer to add one. Never stage or commit the handoff.

  Outside a repository, fall back to the OS temp directory (`$TMPDIR`, `/tmp`, or `%TEMP%`).

- **Chat / Cowork:** write it to the outputs directory (`/mnt/user-data/outputs/handoff-<topic>-<date>.md`) and present the file so the user can download it. Files that are written but not presented are unreachable, which defeats the point. Tell the user to download it.

Either way, add one line naming the path and how to use it: paste the file, or its contents, into the first message of the new session.

## Anti-patterns

- Narrating the conversation chronologically ("first we tried X, then you asked about Y").
- Restating a spec or plan document that already exists.
- Padding with generic advice the next agent already knows.
- Vague next steps: "continue the refactor" instead of "finish converting `handlers/*.go` to the new context signature; `auth.go` and `billing.go` remain".
- Quietly omitting a failure or a mistake because it's unflattering. The next session will hit the same wall.
