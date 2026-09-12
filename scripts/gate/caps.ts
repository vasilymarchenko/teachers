/**
 * The three caps the bounded review loop of `/teachers-ticket` phase 7 runs
 * under. They live here, in code, because a number restated in two skill files
 * drifts out of step with itself the first time one of them is edited (T-029).
 *
 * The file that states the caps in prose is
 * `.claude/skills/teachers-fix-loop/SKILL.md`, which owns the loop they bound
 * (T-034); every other skill that mentions them cites this path instead of a
 * numeral. `scripts/gate/skills.test.ts` holds them all to that.
 *
 * They are durable, not unskippable. `npm run gate -- --report` refuses to
 * report a ticket done past a cap, and the counts come from files the agent
 * did not author — but nothing compels anyone to run `--report` at all. The
 * honest backstops past that point are outside the session: `gh pr checks`,
 * and the person reading the report.
 */
export const CAPS = {
  /** Review → triage → fix → gate → re-review passes in phase 7. */
  reviewRounds: 3,
  /** `npm run gate` invocations inside one review round. */
  gateRunsPerRound: 3,
  /** Pushes to the pull request after the one that opened it. */
  pushesAfterOpening: 3,
} as const;

export type CapName = keyof typeof CAPS;
