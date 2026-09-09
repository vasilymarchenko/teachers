/**
 * Rendering: the table a developer reads, and the markdown a pull request body
 * carries.
 *
 * The ledger is gitignored, so the summary here is the only form of it a
 * reviewer ever sees (ADR-011). It therefore has to say what ran, against which
 * commit, and what was *not* run — a check that was skipped and a check that
 * passed must never look alike.
 */

import {
  cappedChecks,
  currentlyRed,
  flakes,
  MAX_FIX_ATTEMPTS,
  MAX_REVIEW_ROUNDS,
  type LedgerRow,
  type RunSummary,
} from "./ledger";
import { convergence, type FindingsFile } from "./findings";

const MARK: Record<LedgerRow["result"], string> = {
  pass: "pass",
  fail: "FAIL",
  skipped: "skip",
  flake: "flake",
};

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

/** The one table `npm run gate` prints. */
export function runTable(summary: RunSummary): string {
  const nameWidth = Math.max(5, ...summary.rows.map((row) => row.name.length));
  const lines = [
    `${pad("check", nameWidth)}  result  exit  time`,
    `${"-".repeat(nameWidth)}  ------  ----  ----`,
  ];
  for (const row of summary.rows) {
    lines.push(
      [
        pad(row.name, nameWidth),
        pad(MARK[row.result], 6),
        pad(row.exitCode === null ? "-" : String(row.exitCode), 4),
        `${(row.durationMs / 1000).toFixed(1)}s`,
      ].join("  "),
    );
  }

  const counted = (result: LedgerRow["result"]) =>
    summary.rows.filter((row) => row.result === result).length;

  lines.push("");
  lines.push(
    `${counted("pass")} passed, ${counted("fail")} failed, ` +
      `${counted("flake")} flaky, ${counted("skipped")} skipped — ` +
      `${summary.commit} on ${summary.branch}, against ${summary.base}`,
  );
  return lines.join("\n");
}

/** Why each skipped check was skipped, so a skip is never read as a pass. */
export function skipNotes(summary: RunSummary): string[] {
  return summary.rows
    .filter((row) => row.result === "skipped")
    .map((row) => `${row.name}: ${row.detail ?? "skipped"}`);
}

/** The markdown block the pull request body carries under **Tests**. */
export function markdownSummary(
  rows: readonly LedgerRow[],
  findings: FindingsFile | null,
): string {
  const latest = new Map<string, LedgerRow>();
  for (const row of rows) latest.set(row.name, row);

  const lines = ["| Check | Result | Commit | When |", "|---|---|---|---|"];
  for (const row of latest.values()) {
    const note = row.result === "skipped" ? ` — ${row.detail ?? "not run here"}` : "";
    lines.push(
      `| \`${row.name}\` | ${MARK[row.result]}${note} | \`${row.commit}\` | ${row.at} |`,
    );
  }

  const flaked = flakes(rows);
  if (flaked.length > 0) {
    lines.push("");
    lines.push(
      `Flaky on one re-run, ticket owed: ${flaked.map((row) => `\`${row.name}\``).join(", ")}.`,
    );
  }

  if (findings) {
    const state = convergence(findings);
    lines.push("");
    lines.push(
      `Review rounds: ${state.counts.map((count, index) => `${index + 1} → ${count}`).join(", ")} ` +
        `finding(s); ${state.openInLastRound} undisposed in the last round.`,
    );
    for (const round of findings.rounds) {
      for (const finding of round.findings) {
        lines.push(
          `- \`${finding.id}\` ${finding.file} — ${finding.summary} → ` +
            `**${finding.disposition ?? "open"}**` +
            (finding.ticket ? ` (${finding.ticket})` : ""),
        );
      }
    }
  }

  return lines.join("\n");
}

/**
 * `npm run gate --report`: the loop's state, computed from the ledger.
 *
 * Returns the text and whether the loop may report the ticket done. Everything
 * that says "not yet" here is a fact about a file, not a judgement about the
 * conversation.
 */
export function loopReport(
  rows: readonly LedgerRow[],
  findings: FindingsFile | null,
): { text: string; done: boolean } {
  const blockers: string[] = [];
  const lines: string[] = [];

  if (rows.length === 0) {
    return {
      text: "The ledger is empty: no gate has run. `npm run gate` first.",
      done: false,
    };
  }

  const red = currentlyRed(rows);
  if (red.length > 0) blockers.push(`red check(s): ${red.join(", ")}`);

  const capped = cappedChecks(rows);
  if (capped.length > 0) {
    blockers.push(
      `fix cap of ${MAX_FIX_ATTEMPTS} reached by ${capped.join(", ")} — stop and report`,
    );
  }

  const flaked = flakes(rows);
  if (flaked.length > 0) {
    lines.push(
      `Flakes to file as tickets: ${flaked.map((row) => row.name).join(", ")}.`,
    );
  }

  if (findings === null) {
    blockers.push("no findings file: phase 7 has not recorded a review round");
  } else {
    const state = convergence(findings);
    lines.push(
      `Rounds: ${state.rounds}; findings per round: ${state.counts.join(", ")}.`,
    );
    for (const problem of state.problems) blockers.push(problem);
    if (state.openInLastRound > 0) {
      blockers.push(
        `${state.openInLastRound} finding(s) undisposed in round ${state.rounds}`,
      );
    }
    if (state.cappedOut) {
      blockers.push(
        `review cap of ${MAX_REVIEW_ROUNDS} rounds reached with findings still open — stop and report`,
      );
    }
  }

  lines.push("");
  lines.push(markdownSummary(rows, findings));

  if (blockers.length > 0) {
    lines.unshift(...blockers.map((blocker) => `NOT DONE — ${blocker}`), "");
  } else {
    lines.unshift("Loop converged: every check green and every finding disposed.", "");
  }

  return { text: lines.join("\n"), done: blockers.length === 0 };
}
