# Backlog

File-per-item backlog kept in git; there is no external tracker. Conventions and
required frontmatter: [`CLAUDE.md`](CLAUDE.md).

`status` is authoritative in each item's frontmatter — the tables below mirror it
for reading. Order is priority; the ID number is not.

## Tickets

| ID | Title | Status | Depends on |
|---|---|---|---|
| [T-002](T-002-project-scaffold.md) | Project scaffold — Next.js, Drizzle, Vitest, Postgres in Compose | done | — |
| [T-001](T-001-expand-fixtures.md) | Golden fixtures for `expand()` — the hard-week walkthrough | done | — |
| [T-003](T-003-db-schema-design.md) | Detailed DB schema design document | done | T-001 |
| [T-004](T-004-drizzle-schema-migration.md) | Drizzle schema, first migration, and the overlap constraint test | done | T-002, T-003 |
| [T-005](T-005-domain-schedule-functions.md) | Schedule domain — today, parity, calendar rules, boundaries, expand | done | T-001, T-002 |
| [T-006](T-006-auth-and-query-discipline.md) | Auth boundary and `user_id` query discipline | done | T-004 |
| [T-008](T-008-calendar-read-queries.md) | Read queries for the calendar data path | done | T-004, T-006 |
| [T-014](T-014-app-shell.md) | Application shell — navigation, layout and visual style | done | T-002 |
| [T-017](T-017-review-skill.md) | Review skill that reads the documents | done | — |
| [T-018](T-018-adr-practice.md) | ADR practice — record significant decisions where they can be found | done | — |
| [T-019](T-019-findable-invariants.md) | Make the architecture's invariants findable in the document | todo | T-017 |
| [T-020](T-020-skill-project-prefix.md) | Prefix project-specific skills and agents with teachers- | done | — |
| [T-009](T-009-year-setup-screens.md) | Year setup — year, semesters, non-teaching periods, bells, parity | done | T-006, T-014 |
| [T-012](T-012-events-and-recurrence.md) | Events — deadlines, info events and recurrence expansion | done | T-005, T-007, T-008, T-014 |
| [T-007](T-007-calendar-read-views.md) | Calendar read views — day, week, month, year | done | T-005, T-008, T-014 |
| [T-010](T-010-weekly-template-editor.md) | Weekly template editor with copy-on-write versioning | done | T-005, T-008, T-014 |
| [T-011](T-011-day-override-editing.md) | Day overrides — edit, substitution, cancel a single lesson | done | T-007 |
| [T-013](T-013-print-views.md) | Print mechanism — the `/print` route and its page layout | todo | T-007 |
| [T-021](T-021-week-view-overflow.md) | Week view — lesson text overflows the day card from the xl breakpoint | todo | T-007 |
| [T-016](T-016-sign-in-rate-limit.md) | Rate limiting on sign-in | todo | T-006 |
| [T-022](T-022-mutation-returning-convention-test.md) | Convention test — every UPDATE in `lib/actions` checks the rows it matched | todo | T-009 |
| [T-023](T-023-unrendered-field-errors.md) | A field error whose field is not on the screen must still be shown | todo | T-009, T-010 |
| [T-015](T-015-deploy-pipeline.md) | Deploy pipeline — GHCR image, Compose on the VPS, Caddy, migrations | done | T-002, T-004 |
| [T-024](T-024-ci-gate-on-every-commit.md) | CI — run the full gate on every pushed commit, and gate the image publish on it | done | T-015 |
| [T-025](T-025-enable-branch-protection.md) | Enable branch protection on `main` so the CI gate blocks rather than reports | todo | T-024 |

## Open questions

Each mirrors a section of `docs/architecture/architect-overview.md` §10.

| ID | Title | Status | Blocks |
|---|---|---|---|
| [Q-001](Q-001-parity-across-breaks.md) | Does a full break week consume a parity position? | open | — (default lives in `parity.ts`) |
| [Q-003](Q-003-print-report-list.md) | Which printed reports are actually required | open | — (only the reports beyond the first) |
| [Q-005](Q-005-student-contacts.md) | Student contact structure — one contact or several with roles | open | — (second phase, no ticket yet) |
| [Q-006](Q-006-is-taught-by-me-matching.md) | How `isTaughtByMe` matches a CLASS lesson to an OWN lesson | open | — (default pinned in `design/expand-fixtures.md` §8.6) |
| [Q-004](Q-004-server-pdf-renderer.md) | Server-side PDF renderer, if one is ever needed | open | — (deferred with the feature) |
| [Q-002](Q-002-mobile-template-editor.md) | Mobile interaction pattern for the weekly template editor | answered | — (answer in `architect-overview.md` §10.2) |

## Dependency shape

```
T-002 scaffold ──┬──> T-014 shell ─────────────────────────> T-009 year setup ──┬──> T-022 UPDATE test
                 │                                                              └──> T-023 field errors *
                 │
                 ├──> T-005 domain ──┐
                 │                   │
T-001 fixtures ──┴──> T-003 schema doc ──> T-004 schema+migration ──┬──> T-015 deploy ──> T-024 CI gate
                                     │                              │
                                     │                 ┌──> T-016 sign-in rate limit
                                     └──> T-006 auth ──┴──> T-008 queries
                                                              │
                                                              ├──> T-007 calendar views
                                                              │         │
                                                              │         ├──> T-011 overrides
                                                              │         ├──> T-013 print
                                                              │         ├──> T-021 week overflow
                                                              │         └──> T-012 events
                                                              └──> T-010 template editor
```

T-001 and T-002 had no dependencies and were two parallel tracks — the paper
track and the code track — rather than a ranked pair; T-002 is listed first only
because nothing is runnable before it. T-001 is done: its output,
`docs/architecture/design/expand-fixtures.md`, is the input T-003 and T-005 read.
T-017 and T-018 are absent from the diagram: they change the review tooling and
the documentation practice rather than the application, and nothing in the
diagram waits on either. T-019 follows from T-017 and touches only
`architect-overview.md`. T-022 hangs off T-009 for its subject matter, not its
code: it turns a rule that ticket's review had to enforce by hand into one the
test suite enforces, so it is review tooling in the same sense as T-017. T-023
is the same shape and hangs off both T-009 and T-010, because one defect turned
up in both reviews and was fixed by hand each time — the `*` in the diagram
marks that second edge, which the tree has no room to draw.
No item waits on an open question any more: Q-002, the one that did, is answered
(`architect-overview.md` §10.2). T-014 is done, so the UI tickets that waited on
the shell — T-007, T-009, T-010 and T-012 — are done, so every dependency they
carried is satisfied. T-011, which hangs off T-007 alone, is done too; T-013 and
T-021, the two open tickets off T-007, are what remain of the calendar work.

## Coverage

The tickets above cover the first release as scoped in `docs/specs/specification.md`
§2 — sections §3–§7 of the specification — plus the deployment path from
`docs/tech-stack.md`. T-017, T-018, T-019, T-022 and T-023 are not product scope:
they are the review tooling those tickets are checked by, and the documents that
tooling reads. T-024 is not product scope either, and is not review tooling: it
is the deployment path checking itself, which is why it hangs off T-015 rather
than off a ticket a review found something in. Second- and third-phase work (class list and birthdays §9,
import §10, AI) has no tickets by design; `architect-overview.md` §7 records the
extension points those will use.
