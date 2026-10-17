---
id: ADR-031
title: Codex reads the harness through thin adapters over the Claude Code files, which stay canonical
status: accepted
date: 2026-10-17
ticket: —
---

## Context

The harness (`docs/architecture/harness.md`) was built for Claude Code and lives
where Claude Code looks for it: the root `CLAUDE.md`, `.claude/skills/`,
`.claude/agents/`, and a `SessionStart` hook registered in
`.claude/settings.json`. The user wants the same harness usable from Codex.

Most of it is already agent-neutral: `npm run gate` and everything under
`scripts/gate/`, `ci.yml`, the state files under `.gate/` (a run started by one
agent can be resumed by the other with `--resume`), and every document under
`docs/`. What is not neutral is how an agent finds the rest, and what the rest
tells it to call:

- **Root instructions.** Codex reads `AGENTS.md`, from the repository root down
  to the working directory. It does not read `CLAUDE.md` unless each machine's
  own Codex configuration names it as a fallback filename. Claude Code reads
  `CLAUDE.md` and resolves `@path` imports in it. Codex has no import. The
  pinned `next` (16.3.3, `generate-agent-files.js`) writes its managed block
  into `AGENTS.md` whenever that file exists and `CLAUDE.md` does not already
  hold the block. When neither file exists, it scaffolds `AGENTS.md` with the
  block and a `CLAUDE.md` of `@AGENTS.md` alone.
- **Skills.** Both agents read the same `SKILL.md` format: `name` and
  `description` in the frontmatter, and a body loaded only when the skill is
  used. Claude Code reads `.claude/skills/`. Codex reads `.agents/skills/` in
  every directory from the working directory up to the repository root. The
  files can be shared, but the directories cannot.
- **Subagents.** Claude Code reads `.claude/agents/*.md`, with `tools` and
  `model` in the frontmatter. Codex defines custom agents in TOML under
  `.codex/agents/`, with its own fields for instructions, model and sandbox.
  The formats differ, so one file cannot serve both.
- **Hook.** Codex reads `SessionStart` hooks from `.codex/hooks.json`, and
  runs a project's hooks only once the user has trusted that project. The
  script `.claude/hooks/session-start-fetch.sh` is plain bash and git. Only its
  registration is Claude Code's.
- **Tool names in the bodies.** The skills and agents name tools that exist only
  in Claude Code: `AskUserQuestion`; the built-in subagents `Plan`, `Explore`
  and `general-purpose`; the built-in skill `/code-review`, whose effort levels
  `teachers-review` adopts as its own vocabulary; and the `Skill` tool that
  `teachers-review-round` uses.
- **`npm run cost`** reads Claude Code's transcripts
  (`~/.claude/projects/<slug>/*.jsonl`). Codex writes its sessions somewhere
  else, in another format.
- **Windows.** A developer of this repository works on Windows (`T-064`, Notes).
  There, git checks out a symlink as a link only with `core.symlinks` enabled
  and the right to create links. Otherwise the symlink becomes a small text
  file holding the target path.

The Codex locations and formats above come from Codex's documentation as of the
date of this record. The tickets that carry this decision out check each one
against the Codex version in use, and record that version.

## Options

**A second harness for Codex, copied into its own locations.** Every rule
exists twice and drifts at the first edit, which is what `ADR-001` and the
one-fact-one-place rule exist to prevent. Nothing would detect the drift.

**Move everything into a neutral tree (`.agents/`), and point Claude Code at it
with symlinks.** It is the cleanest layout in principle. It costs a rename of
every path the tests, the skills, `harness.md` and `ADR-002` name. It also puts
the agent every run uses today behind a symlink. On a Windows checkout without
symlink support, Claude Code silently loses every skill and agent. That moves
the risk onto the side that works now, in exchange for the side that does not
exist yet.

**Generate the second agent's files from the first, and hold them equal with a
test** — the shape `ADR-012` chose for `checks.ts` and `ci.yml`. It works on
every platform. But every change to a skill appears twice in a diff, a review
reads it twice, and a generator has to be maintained. `ADR-012` paid that cost
for two definitions in two languages. Here the copy would be byte for byte, and
a link can express that without a copy.

**Make `CLAUDE.md` canonical and give Codex an `AGENTS.md` that says "read
`CLAUDE.md`".** It moves nothing. But Codex has no import, so its instructions
would arrive only if the model followed the pointer, every session. Claude
Code's `@AGENTS.md` import resolves mechanically, so `AGENTS.md` is the
direction that does not depend on a model's diligence.

**Keep Claude Code's files canonical where they are, and give Codex thin
adapters that resolve to them.** What breaks if an adapter fails is the
secondary agent only, and a test can detect that. The cost: `.claude/` now
holds files that are not Claude-only, and its name says otherwise. A Codex
subagent reaches its body through an instruction to read a file, which is one
step the model must take.

## Decision

The Claude Code files stay canonical where they are. Codex gets adapters that
hold nothing of their own:

1. **Root instructions** live in `AGENTS.md`, a regular file. The root
   `CLAUDE.md` holds `@AGENTS.md` and only what Claude Code alone needs. The
   subtree `CLAUDE.md` files (`docs/backlog/`, `docs/features/`,
   `docs/scenarios/`) keep their names and paths, and `AGENTS.md` requires them
   to be read before writing into their directory.
2. **Skills** live in `.claude/skills/`. `.agents/skills` is a relative symlink
   to `../.claude/skills`, and nothing else is under `.agents/`. A test fails
   if the link is missing, points elsewhere, or was checked out as a file.
3. **Subagents**: each body lives in `.claude/agents/<name>.md`. Each Codex
   adapter, `.codex/agents/<name>.toml`, holds only the instruction to read and
   follow that body, the model, and a sandbox no wider than the body's own
   limits. A test holds the two sets one-to-one.
4. **The `SessionStart` hook** is one script,
   `.claude/hooks/session-start-fetch.sh`, registered by both
   `.claude/settings.json` and `.codex/hooks.json`.
5. **A skill or agent body names a capability, not a tool of one agent** —
   ask the user, dispatch a named subagent, dispatch a read-only explorer, run
   the generic correctness review. One section of `AGENTS.md` binds each
   capability to its tool in each agent, and where Codex has no counterpart it
   says what Codex does instead. That section is the only place a
   Claude-only or Codex-only tool name appears in a body's instructions.
6. **What one agent has and the other cannot do is declared, not emulated.**
   `npm run cost` is Claude Code only, and `harness.md` says so.
7. **The `teachers-` prefix of `ADR-002` applies to every adapter.** Branch names
   (`claude/ticket-t-NNN-…`) are unchanged, for the reason `ADR-002` gives.

The work is `T-066`–`T-070`.

## Consequences

Claude Code works exactly as before at every step of the migration. The only
file it reads differently is the root `CLAUDE.md`, through an import. Codex
gets the same skills, the same gate, the same state files and the same
documents, so either agent can resume a run the other started.

A skill keeps working in Claude Code if the link breaks, but disappears from
Codex. The link test turns that from a silent loss into a red gate on the
checkout that has it.

A capability that one agent does better than the other is bound per agent, not
lowered to the common denominator. The generic correctness pass is the one
place where the two agents can review the same diff at different depths. The
review report already has to say which passes ran, so it also says which
binding ran.

Revisit when:

- Claude Code reads `.agents/skills/` itself, or Codex reads `.claude/skills/`.
  The link is then redundant, and the neutral tree costs only a rename.
- A third agent is added. Three sets of adapters over one agent's directory is
  where the neutral tree begins to pay for its rename.
- A developer's checkout cannot keep the link (Windows without symlink support,
  or a tool that copies the tree). The generated-copy option then becomes the
  cheaper one.
- Codex subagents do not reliably follow an adapter's instruction to read their
  body. The TOML is then generated from the body, with a test holding them
  equal.
