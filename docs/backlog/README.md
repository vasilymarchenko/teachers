# Backlog

File-per-item backlog kept in git; there is no external tracker. Conventions and
required frontmatter: [`CLAUDE.md`](CLAUDE.md).

`status` is authoritative in each item's frontmatter — the tables below mirror it
for reading. Order is priority; the ID number is not.

## Tickets

| ID | Title | Status | Depends on |
|---|---|---|---|
| [T-001](T-001-expand-fixtures.md) | Golden fixtures for `expand()` — the hard-week walkthrough | todo | — |
| [T-002](T-002-project-scaffold.md) | Project scaffold — Next.js, Drizzle, Vitest, Postgres in Compose | todo | — |
| [T-003](T-003-db-schema-design.md) | Detailed DB schema design document | todo | T-001 |
| [T-004](T-004-drizzle-schema-migration.md) | Drizzle schema, first migration, and the overlap constraint test | todo | T-002, T-003 |
| [T-005](T-005-domain-schedule-functions.md) | Schedule domain — today, parity, calendar rules, boundaries, expand | todo | T-001, T-002 |
| [T-006](T-006-auth-and-query-discipline.md) | Auth boundary and `user_id` query discipline | todo | T-004 |
| [T-007](T-007-calendar-read-views.md) | Calendar read views — day, week, month, year | blocked | T-005, T-006, Q-002 |

## Open questions

Each mirrors a section of `docs/architecture/architect-overview.md` §10.

| ID | Title | Status | Blocks |
|---|---|---|---|
| [Q-002](Q-002-mobile-template-editor.md) | Mobile interaction pattern for the weekly template editor | open | T-007, template editor |
| [Q-001](Q-001-parity-across-breaks.md) | Does a full break week consume a parity position? | open | — (default in `parity.ts`) |
| [Q-003](Q-003-print-report-list.md) | Which printed reports are actually required | open | print work |
| [Q-005](Q-005-student-contacts.md) | Student contact structure — one contact or several with roles | open | second phase |
| [Q-004](Q-004-server-pdf-renderer.md) | Server-side PDF renderer, if one is ever needed | open | — (deferred with the feature) |

## Dependency shape

```
T-001 fixtures ──┬──> T-003 schema doc ──> T-004 schema+migration ──> T-006 auth
                 │                                                        │
T-002 scaffold ──┴──> T-005 domain ──────────────────────────────────────┬┘
                                                                         │
                                          Q-002 mobile pattern ──────────┴──> T-007 calendar views
```

T-001 and T-002 have no dependencies and can start in any order. Only UI work
waits on an open question; the schema and domain track is unblocked.
