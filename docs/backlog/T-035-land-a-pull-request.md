---
id: T-035
type: ticket
title: /teachers-land — the fix-and-merge loop for a pull request with no ticket bound
status: todo
depends_on: [T-034]
refs:
  - docs/architecture/decisions/ADR-014-review-measures-the-loop-fixes.md
  - docs/architecture/decisions/ADR-001-review-reads-the-documents.md
  - .claude/skills/teachers-ticket/SKILL.md
  - .claude/skills/teachers-review/SKILL.md
  - docs/backlog/T-034-bound-the-ticket-loop-context.md
---

## Goal

Give the loop `T-034` extracts its second entry point: a pull request this
session did not produce, driven to no undisposed finding, a green check and a
merge, without selecting a backlog ticket or cutting a branch first.

## Acceptance criteria

- [ ] `/teachers-land <pr>` resolves the pull request, checks it out, and runs
      the loop `T-034` extracted — the same caps, the same four dispositions,
      the same counts derived from records the agent did not author, the same
      state file. No cap, disposition or count rule is restated in this skill.
- [ ] The skill takes `--effort`, `--merge` and `--comment` and passes them to
      `/teachers-review`; it states which defaults it applies and why they differ
      from a self-review, if they do.
- [ ] With no ticket bound, the loop skips what only a ticket makes possible —
      ticking acceptance criteria, setting a backlog status — and the skill says
      so rather than silently doing less than `/teachers-ticket` does.
- [ ] A ticket found in the branch name, the pull request title or body is used
      the way `/teachers-review` already finds one, and stated in the report. It
      is never guessed from a resemblance.
- [ ] A finding out of scope is `deferred` to a `T-NNN` that exists, mirrored in
      `README.md`, exactly as `/teachers-ticket` requires.
- [ ] Merging happens only through `/teachers-review`'s `--merge` policy and its
      conditions; this skill re-decides none of them.
- [ ] The skill edits nothing under `.claude/**` and holds no architectural rule
      (`ADR-001`).
- [ ] `/teachers-land` appears in the skill list with its arguments explained in
      its frontmatter `description`, as `T-033` requires of the others.
- [ ] Run once end to end on a real pull request, and the cost measured with the
      script `T-034` adds.

## Notes

`ADR-014` records why the fix loop is a caller of the review rather than a flag
on it, and why there is one loop with two entry points rather than two loops.

The name is `land` in the sense of landing a change: the skill's subject is
getting a pull request merged, not the fixing that happens on the way.
