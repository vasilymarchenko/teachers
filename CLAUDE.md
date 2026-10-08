# CLAUDE.md

## Documents

What is built and what is next is tracked in `docs/backlog/README.md`, not here. The planning documents are:

- `docs/specs/specification.md` — product specification (Ukrainian), the primary document
- `docs/tech-stack.md` — stack and its rationale
- `docs/architecture/architect-overview.md` — application architecture: data model, layers, trade-offs (§9) and open questions (§10)
- `docs/architecture/glossary.md` — binds each Ukrainian product term to its English identifier; new domain terms go there first
- `docs/architecture/decisions/` — ADRs: one file per significant decision, English, dated and immutable; they record why, which alternatives were rejected and at what cost, while `architect-overview.md` states what is true **now**. When to write one, the conventions and the template: `docs/architecture/decisions/README.md`
- `docs/architecture/lesson-input-and-import.md` — a plain-Ukrainian guide: the data model, template versions, `expand()` and the lesson input chain as built, then the proposed import (ADR-028, ADR-029); it restates and links, and its sources win where they differ
- `docs/architecture/harness.md` — map of the development harness: the skills, agents, hook, gate, CI and `.gate/` state, who calls whom and which file owns which fact
- `docs/backlog/` — the work tracker (there is no external tracker): `T-NNN` tickets and `Q-NNN` open questions, index in `README.md`, conventions in `CLAUDE.md`. A ticket states what to do and when it is done, and references the architecture document rather than restating it

## Commands

Package manager: **npm** (`package-lock.json` is committed). Node version: `.nvmrc`.

```sh
npm run gate         # the checks this change needs, all of them, in one table
npm run test:integration  # the *.integration.test.ts files — needs a migrated Postgres
npm run db:seed      # reset the demo teacher and re-insert the fixture scenario
npm run teacher -- list   # teacher accounts: create | password | deactivate | activate | list
npm run cost         # what one session cost, read out of its own transcript
```

Postgres runs from `docker-compose.yml` (`docker compose up -d`). Copy `.env.example` to `.env` first; `DATABASE_URL` must agree with the `POSTGRES_*` values in the same file. `docker-compose.yml` is dev-only; the production stack (web, Postgres, Caddy) is `docker-compose.prod.yml`, deployed as described in `README.md` ("Deploying to the VPS").

Before pushing, run `npm run gate`: it checks the Node version against `.nvmrc`, selects the checks the change needs by the paths it touches and by `changeKind()` (routing in `scripts/gate/checks.ts`; held in step with `.github/workflows/ci.yml` by ADR-012, with the one declared difference in ADR-016), runs all of them without stopping at the first failure, prints one table and exits non-zero if any failed. A check it cannot run here, or that this kind of change does not need, is reported `skipped` with the reason, which is not a pass. A single test file: `npx vitest run lib/time/today.test.ts`.

## A ticket run, or a direct change

`/teachers-ticket` is the loop for work a backlog ticket describes: it plans, implements, opens a pull request and reviews that pull request against the ticket. It costs what a ticket is worth, and paying it for a change no ticket describes buys nothing.

**A ticket run is needed** for anything that changes the data model, a contract other work is written against, a screen, or the behaviour a teacher sees — that is, for a `T-NNN` in `docs/backlog/`. If the work needs a ticket and has none, the ticket is written first; that writing is itself a direct change.

**A direct change** — no ticket run — is the rest:

- **A change confined to `docs/backlog/**` is the tracker being updated**, not work on the product. Filing a ticket, changing a `status`, correcting a `README.md` row against the frontmatter it mirrors, answering a `Q-NNN`: none of these get a ticket run of their own, and a rule that gave them one would need a ticket to file a ticket. What still holds for them in full is `docs/backlog/CLAUDE.md` — the conventions, the frontmatter contract, and the obligation to update `README.md` in the same commit — plus the checks `T-027` turns into tests.
- A fix a review of another change already found and scoped, a typo, a broken path, a one-line correction to a document.

**Direct means no ticket run. It never means no review, and never a push to `main`.** A direct change owes exactly what any change owes, minus the loop:

- **a branch**, cut from `origin/main`;
- **a commit message in the convention** — English, imperative, saying what changed and why;
- **`npm run gate`**, which routes itself by what the change contains;
- **a review** — `/teachers-review` against the branch or the pull request;
- **a pull request**. `main` is written to by merging one, and by nothing else.

If a direct change turns out to be larger than one commit's worth of reasoning, that is the signal it was a ticket: stop, write the ticket, and run the loop on it.

## A session starts from a current main

Every diff this repository takes — `npm run gate`, `/teachers-review`, the branch a ticket is cut on — is resolved against `origin/main`, a local snapshot left by the last fetch. Keeping it current is the harness's job: a `SessionStart` hook (`.claude/hooks/session-start-fetch.sh`) runs `git fetch origin` and, only when `HEAD` is a clean `main` strictly behind `origin/main` with no unpushed commits, fast-forwards it with `--ff-only`; it never runs `git pull`. Nothing else in the repository fetches. Mechanics: `docs/architecture/harness.md`.

**The reading discipline.** A fetch moves the ref; it does not touch the files on disk. So: content whose current value decides something, read before a branch is cut from `origin/main`, is read from `origin/main` and not from disk — `git show origin/main:<path>`. That holds whatever branch the session is sitting on and whether or not the tree is clean. After a branch is cut with `git checkout -b <branch> origin/main` the working tree *is* the fetched `origin/main`, and everything read from then on is read from disk normally.

**A session whose hook could not run** — no network, no remote — works from what it has and says so: any report it produces states that the repository state was not verified. It is never reported as current.

## Two habits that keep a call small

Every tool call re-sends everything the session has read so far, so the cost of a session grows with the square of the number of calls it makes, and a single inlined command output is paid for again on every call that follows it. Two rules follow. They hold in any session, not only in a `/teachers-ticket` run:

- **Independent reads, searches and shell calls go in one message, not one per turn.** If the next call's arguments do not depend on the previous call's result, issue them together. A file to read, a grep to run and a `git log` to look at are one message with three tool calls; the turn that waits for each in order pays for the whole transcript three times.
- **Command output larger than a screen is written to a file and read back narrowed — never inlined.** Redirect it (`… > .gate/out.txt 2>&1`), then read what you actually need out of it with `grep`, `sed -n` or `tail`. A full `npm test` log, a long `git diff` or a whole-directory listing pasted into the context is bought once and paid for on every subsequent call in the session.

## Code layout

`lib/domain/` is pure and DB-free (the tested part). `lib/actions/` holds the Server Actions — the only writers: `lib/db/queries` stays read-only and a mutation goes to Drizzle directly. The rest of the layout, and why, is in `docs/architecture/architect-overview.md` §2 — that document, not this one, is the place to change it.

Two rules from the architecture that are easy to violate silently:

- **No `new Date()` in domain code.** "Today" comes only from `lib/time/today.ts`, which resolves the date in `Europe/Kyiv` (§8.5). The container runs in UTC; a naive `new Date()` is a day off for three hours every night.
- **`userId` is the first argument** of every function in `lib/db/queries`. A mutation cannot take it first — a Server Action's signature belongs to `useActionState` — so it calls `requireUser()` before any other work and filters every statement by the result. Either way `userId` is only ever obtained from `requireUser()`, never from form or request input (§8.4).

## Not in the first release

Deliberately **not** in the first release: background jobs (queue table + cron) and AI (`@anthropic-ai/sdk`). When jobs are needed, they run as a separate `worker` service in Compose — never a `node-cron` timer inside the web process.

## Language requirements

Language is chosen by **audience**, not by file type. If a teacher could read the text — Ukrainian; if only a developer will — English.

**Ukrainian (product level — the teacher reads it):**
- all UI text, user-facing error messages, notifications, seed/demo data;
- product specifications — `docs/specs/**`;
- must be understandable to a Ukrainian-speaking teacher with no technical background: no untranslated technical jargon, no code identifiers in the prose.

**English (technical level — only developers read it):**
- code, identifiers, code comments, commit messages, PR descriptions;
- the backlog — `docs/backlog/**`, and the agent tooling — `.claude/**`;
- detailed design documents, ADRs, implementation plans, `docs/tech-stack.md`, `README.md`.

**Architecture (the bridge between the two) — `docs/architecture/*.md`, i.e. `architect-overview.md`, `glossary.md` and the guide `lesson-input-and-import.md`:**
- written in **Ukrainian prose with English nouns**: the narrative, reasoning and trade-offs are Ukrainian, but every technical entity keeps its English name verbatim — table, type and field names, file paths, layer names, library names, code blocks. Never translate an identifier into Ukrainian; a translated term is exactly where the document loses its link to the code.
- **Exception — `docs/architecture/design/**` and `docs/architecture/decisions/**` are English.** These two subtrees hold the detailed documents from the English list above: `design/` states mechanics (schema notes, golden fixtures, implementation plans), `decisions/` records why a choice was made and what was rejected. Note that this puts *reasoning* in English in `decisions/` while `architect-overview.md` reasons in Ukrainian: the overview argues from the product requirements a teacher stated, an ADR argues between technical options only. Ukrainian appears in either subtree only inside data a teacher would read — subject names, class names, demo payloads.

**Never keep the same document in two languages.** Documents are split by **level of detail, not by language**:
- `docs/architecture/architect-overview.md` (Ukrainian) — decisions, module boundaries, trade-offs, open questions;
- detailed design docs / ADRs / implementation plans (English) — mechanics: schema, indexes, signatures, migration order.

A detailed document does not restate the overview — it references the relevant section of it. Every fact lives in exactly one place, in exactly one language.

**Glossary.** `docs/architecture/glossary.md` is the single place binding a Ukrainian product term to its English identifier (`заміна → DayOverride.kind = SUBSTITUTION`, `розгорнутий урок → ResolvedLesson`). A new domain term goes there first, then into the code and the documents.

**Chat replies:** Ukrainian if the user's prompt is in Ukrainian or Russian; English if the prompt is in English.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
