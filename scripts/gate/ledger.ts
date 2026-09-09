/**
 * The run ledger: what actually ran, and what it said.
 *
 * A phase that reports itself passed is a phase nothing outside the agent can
 * disagree with. Every check the gate runs appends one row here, and the report
 * at the end of `/teachers-ticket` phase 7 is rendered from these rows rather
 * than from the conversation — so a session resumed after compaction reads the
 * file and continues instead of re-attesting from memory.
 *
 * `.gate/` is gitignored: the ledger's reader is the resuming agent, and a
 * reviewer reads the summary in the pull request body instead. ADR-011.
 */

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const GATE_DIR = ".gate";
export const LEDGER_PATH = join(GATE_DIR, "ledger.jsonl");
export const LAST_RUN_PATH = join(GATE_DIR, "last-run.json");
export const FINDINGS_PATH = join(GATE_DIR, "findings.json");

/**
 * `flake` is `fail` on the first attempt and `pass` on the one permitted
 * re-run. It is deliberately not `pass`: a flake owes a ticket, and a row that
 * says `pass` loses the fact that the check was red once.
 */
export type CheckResult = "pass" | "fail" | "skipped" | "flake";

export type LedgerRow = {
  readonly kind: "check";
  /** Groups the rows written by one `npm run gate`. */
  readonly run: string;
  readonly name: string;
  readonly result: CheckResult;
  /** `null` when the check never started — a missing requirement. */
  readonly exitCode: number | null;
  readonly commit: string;
  readonly branch: string;
  /** ISO 8601, UTC. When the check finished. */
  readonly at: string;
  readonly durationMs: number;
  /** 1 for an ordinary run, 2 for the single permitted re-run of a red check. */
  readonly attempt: 1 | 2;
  /** Why a check was skipped, or the tail of a failure. Absent on a clean pass. */
  readonly detail?: string;
};

/** How many times a red check may be fixed and re-gated before the loop stops. */
export const MAX_FIX_ATTEMPTS = 3;

/** How many review rounds phase 7 may run before it stops and reports. */
export const MAX_REVIEW_ROUNDS = 3;

export function readLedger(root = process.cwd()): LedgerRow[] {
  let raw: string;
  try {
    raw = readFileSync(join(root, LEDGER_PATH), "utf8");
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as LedgerRow);
}

export function appendRows(rows: readonly LedgerRow[], root = process.cwd()): void {
  if (rows.length === 0) return;
  const path = join(root, LEDGER_PATH);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

export type RunSummary = {
  readonly run: string;
  readonly commit: string;
  readonly branch: string;
  readonly at: string;
  readonly base: string;
  readonly changedPaths: readonly string[];
  readonly rows: readonly LedgerRow[];
  readonly ok: boolean;
};

export function writeLastRun(summary: RunSummary, root = process.cwd()): void {
  const path = join(root, LAST_RUN_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(summary, null, 2) + "\n");
}

export function readLastRun(root = process.cwd()): RunSummary | null {
  try {
    return JSON.parse(readFileSync(join(root, LAST_RUN_PATH), "utf8")) as RunSummary;
  } catch {
    return null;
  }
}

/**
 * How many times this check has failed in a row, counting back from the most
 * recent row and stopping at the first row that was not a failure.
 *
 * Deliberately not scoped to a commit: the point of the cap is to stop a loop
 * that keeps editing and re-running, and every edit produces a new commit. A
 * green run, a flake or a skip resets the count, because each of those means
 * the check is no longer the thing blocking the loop.
 */
export function consecutiveFailures(
  rows: readonly LedgerRow[],
  name: string,
): number {
  let count = 0;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row.name !== name) continue;
    if (row.result !== "fail") break;
    count += 1;
  }
  return count;
}

/**
 * Whether one more re-run of this check against this commit is permitted.
 *
 * Exactly one. Green on the re-run is a flake and owes a ticket; red again is a
 * finding. Retrying until green is how a suite that is lying to you keeps its
 * job, so the third attempt is refused by the tool rather than by a rule
 * somebody has to remember.
 */
export function mayRerun(
  rows: readonly LedgerRow[],
  name: string,
  commit: string,
): boolean {
  const forCommit = rows.filter(
    (row) => row.name === name && row.commit === commit,
  );
  if (forCommit.length === 0) return false;
  if (forCommit.some((row) => row.attempt === 2)) return false;
  return forCommit[forCommit.length - 1].result === "fail";
}

/** The checks that are red as of the last row written for each of them. */
export function currentlyRed(rows: readonly LedgerRow[]): string[] {
  const latest = new Map<string, LedgerRow>();
  for (const row of rows) latest.set(row.name, row);
  return [...latest.values()]
    .filter((row) => row.result === "fail")
    .map((row) => row.name);
}

/** Checks that passed on their single re-run and therefore owe a flake ticket. */
export function flakes(rows: readonly LedgerRow[]): LedgerRow[] {
  return rows.filter((row) => row.result === "flake");
}

/** Names of checks that have hit the fix cap and must stop the loop. */
export function cappedChecks(rows: readonly LedgerRow[]): string[] {
  return [...new Set(rows.map((row) => row.name))].filter(
    (name) => consecutiveFailures(rows, name) >= MAX_FIX_ATTEMPTS,
  );
}

export function newRunId(now: Date, commit: string): string {
  return `${now.toISOString().replace(/[:.]/g, "-")}-${commit}`;
}
