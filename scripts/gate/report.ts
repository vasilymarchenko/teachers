/**
 * What the gate prints: one table, one counts line, and the block phase 6
 * pastes into the pull request body (T-029).
 */

import type { Count, CheckResult } from "./ledger";

export interface CheckOutcome {
  name: string;
  result: CheckResult;
  exitCode: number | null;
  durationMs: number;
  /** Why it was skipped, or the tail of a failure's output. */
  reason?: string;
  output?: string;
}

const MARK: Record<CheckResult, string> = {
  passed: "pass",
  failed: "FAIL",
  skipped: "skip",
};

/**
 * The table. One report for the whole change: a lint error and three red tests
 * are one round-trip, not three, which is why the runner does not short-circuit.
 */
export function table(outcomes: readonly CheckOutcome[]): string {
  const width = Math.max(5, ...outcomes.map((o) => o.name.length));
  return outcomes
    .map((outcome) => {
      const timing = `${(outcome.durationMs / 1000).toFixed(1)}s`.padStart(7);
      const suffix = outcome.reason === undefined ? "" : `  ${outcome.reason}`;
      return `  ${outcome.name.padEnd(width)}  ${MARK[outcome.result]}  ${timing}${suffix}`;
    })
    .join("\n");
}

/**
 * The counts, on every run, so a cap being approached is visible in the
 * terminal without anyone opening a file for it.
 */
export function countsLine(counts: Record<string, Count>): string {
  return Object.entries(counts)
    .map(
      ([name, count]) =>
        `${name} ${count.value}/${count.cap}${count.exceeded ? " OVER CAP" : ""}`,
    )
    .join(" · ");
}

/** The block that goes into the pull request body, verbatim. */
export function pullRequestBlock(
  outcomes: readonly CheckOutcome[],
  commit: string,
  dirty = false,
): string {
  const lines = outcomes.map((outcome) => {
    const reason = outcome.reason === undefined ? "" : ` — ${outcome.reason}`;
    return `- \`${outcome.name}\`: **${outcome.result}**${reason}`;
  });
  const skipped = outcomes.filter((o) => o.result === "skipped");
  const note =
    skipped.length === 0
      ? ""
      : "\n\nA skipped check was not run and is not a pass. " +
        `${skipped.map((o) => `\`${o.name}\``).join(", ")} — see the reasons above.`;
  const tree = dirty
    ? `\`${commit.slice(0, 7)}\` plus uncommitted work`
    : `\`${commit.slice(0, 7)}\``;
  return `\`npm run gate\` on ${tree}:\n\n${lines.join("\n")}${note}`;
}
