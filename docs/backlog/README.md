# Backlog

File-per-item backlog kept in git; there is no external tracker. Conventions and
required frontmatter: [`CLAUDE.md`](CLAUDE.md).

`status` is authoritative in each item's frontmatter — the tables below mirror it
for reading. Order is priority; the ID number is not.

## Tickets

| ID | Title | Status | Depends on |
|---|---|---|---|
| [T-038](T-038-first-run-year-setup-gate.md) | A teacher whose year setup is incomplete is sent to year setup, and nowhere else | done | T-009, T-014 |
| [T-039](T-039-teacher-management-console.md) | Manage teacher accounts from the console — create, set password, deactivate, list | done | T-006, T-015 |
| [T-040](T-040-bell-schedule-start-times-only.md) | Bell schedule — the teacher enters start times and one lesson length, ends are computed | done | T-009 |
| [T-041](T-041-year-setup-shows-the-way-out.md) | Year setup shows the teacher the next step, and says when the rest of the app is open | done | T-038 |
| [T-048](T-048-year-setup-browser-test.md) | Browser test for the first year setup, run in a new e2e job of ci.yml | todo | T-041 |
| [T-042](T-042-month-day-is-one-click-target.md) | Month view — the whole day is one click target, not only its number | done | T-007 |
| [T-047](T-047-save-enabled-only-when-changed.md) | Edit forms enable «Зберегти» only when they hold unsaved changes | done | T-009, T-010, T-011, T-012 |
| [T-046](T-046-template-row-clear-icon.md) | Template editor — a lesson row is cleared by an icon, and the clear can be undone before saving | todo | T-010, T-047 |
| [T-043](T-043-template-day-for-both-parity-weeks.md) | Template editor — a lesson row is written into both parity weeks by a per-row toggle, and the form shows where the weeks differ | todo | T-010, T-046, T-047 |
| [T-044](T-044-suggest-entered-values.md) | Lesson fields suggest the subjects, classes and teachers already entered | done | T-010, T-011 |
| [T-045](T-045-my-class-highlight.md) | My class — the teacher names it per year, and my lessons in it are highlighted | todo | T-007, T-009, T-044 |
| [T-036](T-036-session-starts-from-current-main.md) | A session starts from a current main — fetched by a hook, not by remembering | done | — |
| [T-037](T-037-cost-a-change-what-it-is-worth.md) | A change that touches no code costs what it is worth — routed review, routed gate, and when a ticket run is needed at all | done | T-033 |
| [T-033](T-033-review-scope-and-effort.md) | Scope /teachers-review to the change under review, and make its effort level a parameter | done | T-017 |
| [T-034](T-034-bound-the-ticket-loop-context.md) | Bound the context a /teachers-ticket run accumulates | in-progress | T-033 |
| [T-035](T-035-land-a-pull-request.md) | /teachers-land — the fix-and-merge loop for a pull request with no ticket bound | todo | T-034 |
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
| [T-021](T-021-week-view-overflow.md) | Week view — lesson text overflows the day card once the grid column is narrow | done | T-007 |
| [T-016](T-016-sign-in-rate-limit.md) | Rate limiting on sign-in | done | T-006 |
| [T-022](T-022-mutation-returning-convention-test.md) | Convention test — every UPDATE in `lib/actions` checks the rows it matched | done | T-009 |
| [T-023](T-023-unrendered-field-errors.md) | A field error whose field is not on the screen must still be shown | done | T-009, T-010 |
| [T-015](T-015-deploy-pipeline.md) | Deploy pipeline — GHCR image, Compose on the VPS, Caddy, migrations | done | T-002, T-004 |
| [T-024](T-024-ci-gate-on-every-commit.md) | CI — run the full gate on every pushed commit, and gate the image publish on it | done | T-015 |
| [T-025](T-025-enable-branch-protection.md) | Enable branch protection on `main` so the CI gate blocks rather than reports | done | T-024 |
| [T-049](T-049-deploy-script-over-ssh.md) | One deploy script for both servers — PROD run by hand over SSH, DEV on a timer | todo | T-015 |
| [T-026](T-026-deterministic-ticket-loop.md) | Deterministic feedback loop for /teachers-ticket — one gate, a run ledger, a bounded review loop | declined | T-017, T-024 |
| [T-027](T-027-backlog-contract-convention-tests.md) | Convention tests for the backlog and document contract | todo | T-017 |
| [T-028](T-028-index-invariant-composite-fk-join.md) | Make the index-usage invariant accept the composite-FK join | done | T-008 |
| [T-029](T-029-gate-command-and-bounded-loop.md) | One gate command and a bounded review loop for /teachers-ticket | done | T-017, T-024 |
| [T-030](T-030-one-migrator-smoke-definition.md) | One migrator smoke test, called by both CI and the gate | todo | T-029 |
| [T-031](T-031-pin-the-node-version.md) | Pin the Node version where a developer will hit it, not only in CI | done | T-029 |
| [T-032](T-032-gate-counts-under-report.md) | The gate can under-report — a missing origin/main, a dirty tree, an unresolvable opening head | todo | T-029 |
| [T-050](T-050-characterization-tests-for-write-actions.md) | Commands 0/4 — characterization tests for every write Server Action | todo | T-009, T-010, T-011, T-012 |
| [T-056](T-056-commands-pattern-and-events.md) | Commands 1/4 — the command pattern, its convention tests, and the event writes | todo | T-050 |
| [T-057](T-057-commands-year-frame-and-bells.md) | Commands 2/4 — the year frame and the bell schedule | todo | T-056 |
| [T-058](T-058-commands-day-overrides.md) | Commands 3/4 — day overrides | todo | T-056 |
| [T-059](T-059-commands-template.md) | Commands 4/4 — the template, with a dry run, and no write left in lib/actions | todo | T-056, T-043 |
| [T-051](T-051-quick-add-events-from-text.md) | Quick add — free text becomes deadlines and info events through a proposal the teacher confirms | todo | T-056, Q-007 |
| [T-052](T-052-quick-add-lessons-from-text.md) | Quick add — free text becomes template lessons and day overrides, with a preview of the new version | todo | T-043, T-051, T-058, T-059 |
| [T-053](T-053-import-timetable-from-file.md) | Import a timetable from a spreadsheet or a photo as one new template version, with bell times | todo | T-052, T-055, T-057, T-059 |
| [T-055](T-055-plan-a-template-version-from-a-future-date.md) | Plan a new template version from a future date — after a break or from a date — and cancel it by overwriting | todo | T-059 |

## Open questions

Each mirrors a section of `docs/architecture/architect-overview.md` §10.

| ID | Title | Status | Blocks |
|---|---|---|---|
| [Q-001](Q-001-parity-across-breaks.md) | Does a full break week consume a parity position? | open | — (default lives in `parity.ts`) |
| [Q-003](Q-003-print-report-list.md) | Which printed reports are actually required | open | — (only the reports beyond the first) |
| [Q-005](Q-005-student-contacts.md) | Student contact structure — one contact or several with roles | open | — (second phase, no ticket yet) |
| [Q-006](Q-006-is-taught-by-me-matching.md) | How `isTaughtByMe` matches a CLASS lesson to an OWN lesson | open | — (default pinned in `design/expand-fixtures.md` §8.6) |
| [Q-004](Q-004-server-pdf-renderer.md) | Server-side PDF renderer, if one is ever needed | open | — (deferred with the feature) |
| [Q-007](Q-007-ai-import-scope-and-data.md) | Is AI-assisted import in scope, and may teacher data be sent to an external model | open | T-051 |
| [Q-002](Q-002-mobile-template-editor.md) | Mobile interaction pattern for the weekly template editor | answered | — (answer in `architect-overview.md` §10.2) |
| [Q-008](Q-008-future-dated-template-version.md) | May a template edit start on a future date, not only today | answered | — (answer in `architect-overview.md` §10.8) |

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
marks that second edge, which the tree has no room to draw. T-027 and T-029
are absent from the diagram for the reason T-017 and T-018 are: they change the
tooling every other ticket is worked and checked by, not the application. T-027
hangs off T-017 like T-019 and T-022 — a check the review skill may only
propose, promoted into the suite. T-029 hangs off T-017 for the review loop it
bounds and off T-024 for the check list that loop must agree with. T-026 carried
those same edges and is `declined`; T-029 replaces it. T-030, T-031 and T-032 hang off T-029
and are absent for the same reason: T-030 finishes one check T-029 routed but
could not run, T-031 names the runtime that made two of its checks fail for
a cause the gate could not report, and T-032 collects three inputs the gate
cannot resolve and reports as though it had. T-037 hangs off T-033, whose table of what a review runs it gives a second
dimension — the kind of change — and is absent from the diagram for the same
reason as the rest of the tooling work.
T-036 is absent from the diagram for the same reason and depends on nothing: it
makes every session start from a current `main`, which is a precondition of
working any item rather than a step in one, so it is placed first and can be
done before the chain below. T-033, T-034 and T-035 are absent for the same
reason, and are placed after it because every later ticket is worked and checked by the skills they
change. They are one chain, in that order: T-033 hangs off T-017, whose review
skill it scopes and parameterises; T-034 hangs off T-033 for the effort argument
its phase 7 passes, and extracts the fix loop as a named unit while rewriting
it; T-035 hangs off T-034 for that extracted unit, and adds the second entry
point to it (`ADR-014`). Doing them in any other order writes the loop twice. T-028 hangs off T-008 and
is not drawn either: it is a defect in the invariant test that ticket's last
criterion produced, not new work off it.
Outside the import track, no item waits on an open question any more: Q-002,
the one that did, is answered (`architect-overview.md` §10.2). In the import
track, T-051 waits on Q-007. T-014 is done, so the UI tickets that waited on
the shell — T-007, T-009, T-010 and T-012 — are done, so every dependency they
carried is satisfied. T-011 and T-021, which hang off T-007 alone, are done
too; T-013 is what remains of the calendar work. T-038 hangs off T-009 and T-014 and
is not drawn: it puts a gate in front of the screens those two built, for the
teacher whose year setup is incomplete, and nothing in the diagram waits on it. T-039 hangs
off T-006, whose sign-in it adds a refusal to, and off T-015, whose images its
command has to run from; it is not drawn, and nothing in the diagram waits on it.
T-040 hangs off T-009 and is not drawn: it changes how one section of the year
setup screen is entered, and nothing in the diagram waits on it. T-041 hangs
off T-038 and is not drawn: it changes how the gated year setup screen leads
the teacher to the open app. T-048 hangs off T-041 and is not drawn either: it
measures in a browser the walk T-041 designed, and adds the gate job that runs
it; nothing in the diagram waits on either.
T-042 hangs off T-007 and is not drawn: it widens the click target of the month
view that ticket built. T-044 hangs off T-010 and T-011
and is not drawn: it changes how the forms those tickets built are filled.
T-045 hangs off T-009 for the year form it adds a field to, off T-007 for the
views it highlights lessons in, and off T-044 for the class-name suggestions its
field offers; it is not drawn, and nothing in the diagram waits on any of the four.
T-047 hangs off T-009, T-010, T-011 and T-012 for the edit forms whose save
button it gates. T-046 hangs off T-010 for the day form whose rows it gives a
clear action, and off T-047, whose contract for a value set from code its clear
and undo follow. T-043 hangs off T-010 for the day form it adds a toggle to,
and off T-046 and T-047 for the row header it shares with the clear icon and
for the comparison its toggles are left out of. None of the three is drawn.
T-049 hangs off T-015 and is not drawn: it replaces the deploy procedure that
ticket documented with a script, for the two servers ADR-027 names; nothing in
the diagram waits on it.
T-050, T-056–T-059 and T-051–T-053 are the import track (specification §10,
ADR-028, ADR-029) and are not drawn. The first five are the command refactor
of ADR-028, run as a series: T-050 pins down with integration tests what every
write Server Action does now, and hangs off T-009, T-010, T-011 and T-012 for
the actions it tests. T-056 hangs off T-050 and sets the command pattern on the
event writes. T-057 and T-058 hang off T-056 and move the year frame with the
bells, and the day overrides. T-059 hangs off T-056 too, and off T-043, which
changes the template day save it moves; it ends the series with a test that no
write is left in `lib/actions`. None of the five waits on Q-007. T-051 hangs off
T-056 for the event commands and off Q-007 for the decision to build it at
all. T-052 hangs off T-051 for the proposal pipeline it extends, off T-058 and
T-059 for the override and template commands, and off T-043 for the per-row
both-weeks choice its parity question sets. T-053 hangs off T-052 for the
template kinds, off T-057 for the bell schedule command, off T-059 for the
template commands, and off T-055 for the date the imported version starts on,
«після канікул» being the case a new timetable file usually comes with. T-055
answers Q-008 and hangs off T-059, whose template commands it extends with a
future cut. An MCP endpoint was considered and deferred
(ADR-028) and has no ticket.

## Coverage

The tickets above cover the first release as scoped in `docs/specs/specification.md`
§2 — sections §3–§7 of the specification — plus the deployment path from
`docs/tech-stack.md`. T-017, T-018, T-019, T-022, T-023, T-027, T-029, T-030, T-031, T-032, T-033, T-034, T-035, T-036 and T-037 are
not product scope: they are the review tooling those tickets are checked by, and
the documents that tooling reads. T-024 is not product scope either, and is not review tooling: it
is the deployment path checking itself, which is why it hangs off T-015 rather
than off a ticket a review found something in. Second-phase work (class list and birthdays §9)
has no tickets by design; `architect-overview.md` §7 records the extension
points it will use. Import (§10) and AI are third-phase work that now has
tickets, T-050–T-053 and T-056–T-059, of which T-051–T-053 wait on Q-007 — the
decision to bring them into scope; the command refactor and T-055 do not. T-039 is outside the specification too: it is
what the person running the deployment uses to give a teacher an account, not a
screen a teacher sees.
