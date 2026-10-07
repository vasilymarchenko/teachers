---
id: T-053
type: ticket
title: MCP endpoint — an AI client enters and reads calendar data through the commands, signed in as the teacher
status: todo
depends_on: [T-049, T-050, Q-007]
refs:
  - docs/architecture/decisions/ADR-027-writes-are-commands-and-transports-are-adapters.md
  - docs/architecture/decisions/ADR-028-the-model-proposes-and-deterministic-code-writes.md
  - docs/architecture/lesson-input-and-import.md §8
  - docs/architecture/architect-overview.md §8.3
  - docs/architecture/architect-overview.md §8.4
---

## Goal

The teacher connects their own AI assistant to the application and asks it,
in their own words, to enter a deadline, a lesson or a day override, or to
read what is on a given day. The application serves an MCP endpoint from a
Route Handler in the same Next.js app. Its tools call the T-049 commands and
the `lib/db/queries` reads directly, with `userId` taken from a verified token.

## Acceptance criteria

- [ ] The endpoint authenticates with OAuth as the MCP specification requires,
      issued by better-auth, and resolves `userId` from the token alone. A tool
      argument named like a user id is rejected by the schema.
- [ ] Write tools mirror the closed set of kinds in the T-050/T-051 proposal
      schema, take the same payloads and date expressions, and default to
      `dryRun`. The client must call again with `dryRun: false` to write.
- [ ] Read tools return the resolved days of a date range (`expand()` through
      the calendar's own loader), the event list, and the lesson suggestions.
- [ ] A refusal is returned as the command's `code`, `field` and `message`.
- [ ] A deactivated teacher's token is refused, like a session (ADR-019).
- [ ] Write tools take an idempotency key, and a repeated key within a day
      returns the first result without writing again.
- [ ] Calls are rate-limited per teacher.
- [ ] `architect-overview.md` §8.3 names the endpoint as the second
      authentication path and what it shares with the session path.

## Notes
