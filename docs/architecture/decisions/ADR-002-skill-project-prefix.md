---
id: ADR-002
title: Every skill and agent in this repository carries a teachers- prefix
status: accepted
date: 2026-08-30
ticket: T-020
---

## Context

`.claude/skills/review/`, `.claude/skills/ticket/` and
`.claude/agents/review-contract.md` were named for what they do, not for what
project they belong to. That works as long as this repository's `.claude/`
tree is the only source of skills and agents in the session, but Claude Code
also loads skills from plugins and, in a multi-project setup, from other
repositories. `review` and `ticket` are generic enough that a second skill
with either name — a plugin's own `/review`, or the same repository pattern
reused in a sibling project — collides on invocation, and the collision is
resolved by load order rather than by anything the user chose.

## Options

**Leave names generic, rely on directory scoping.** Claude Code does disambiguate
same-named skills from different directories by path prefix when it can, but
that only helps once a collision is already visible; the user still has to
notice which `/review` fired, and a slash command typed from muscle memory in
another project's session silently reaches the wrong skill if this repository
is loaded as a plugin or dependency elsewhere.

**Prefix with the project name at call sites only, keep directory names
generic.** Half-measure: the collision this is meant to prevent happens at the
directory/registration level, not at the point some document happens to spell
the command.

**Prefix every project skill and agent name with `teachers-`.** The name is
unambiguous the moment it is typed or listed, in any session that has this
repository's tools loaded alongside others. Costs a slightly longer command
and a rename whenever a skill is added.

## Decision

Every skill and agent defined under this repository's `.claude/` gets a
`teachers-` prefix on its directory or file name and its frontmatter `name:`
field: `teachers-review`, `teachers-ticket`, `teachers-review-contract`. This
applies going forward to any new skill or agent added to `.claude/skills/` or
`.claude/agents/` — the prefix is not optional for the next one because the
current ones happen to need it.

Git-branch-naming conventions (`claude/ticket-t-NNN-<slug>`) are unrelated —
that `ticket` is English prose describing backlog tickets, not an invocation
of the `/teachers-ticket` skill, and stays as it is.

## Consequences

Every reference to these tools inside their own files and in any document that
names them must use the prefixed form; a document written before this decision
that names the old form is not retroactively wrong, since it is describing
what was true when it was written — `T-017`, `T-018` and `ADR-001` keep
`/review`, `/ticket` and `review-contract` in their prose, unedited.

The command is a few characters longer to type. That cost is paid once per
invocation and is smaller than the cost of a misdirected command in a session
that has more than this repository's tools loaded.
