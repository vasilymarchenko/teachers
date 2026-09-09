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
  /**
   * What was actually checked: the commit when the tree was clean, the commit
   * plus a digest of the uncommitted change when it was not (`git.ts`). The
   * commit above is for reading; the attempt count and the staleness check key
   * on this.
   */
  readonly tree: string;
  readonly branch: string;
  /** ISO 8601, UTC. When the check finished. */
  readonly at: string;
  readonly durationMs: number;
  /** 1 for an ordinary run, 2 for the single permitted re-run of a red check. */
  readonly attempt: 1 | 2;
  /** Why a check was skipped, or the tail of a failure. Absent on a clean pass. */
  readonly detail?: string;
};

/**
 * How many times a red check may be fixed and re-gated before the loop stops.
 *
 * Distinct from the single re-run of `attemptFor`: that asks the same question
 * of the same tree twice, to tell a flake from a red check. This counts how
 * many *different* trees have failed the check in a row.
 */
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
  return readLedgerLines(raw).rows;
}

/**
 * Parses the ledger, surviving a line that is not JSON.
 *
 * An `appendFileSync` interrupted mid-write, or a hand edit, otherwise makes
 * every later `npm run gate` and every `--report` throw — and this file is the
 * loop's only memory, so the failure mode is the loop losing everything it
 * knows over one truncated line. A damaged line is skipped and counted.
 */
export function readLedgerLines(raw: string): { rows: LedgerRow[]; damaged: number } {
  const rows: LedgerRow[] = [];
  let damaged = 0;
  for (const line of raw.split("\n")) {
    if (line.trim() === "") continue;
    try {
      rows.push(JSON.parse(line) as LedgerRow);
    } catch {
      damaged += 1;
    }
  }
  return { rows, damaged };
}

export function readLedgerWithDamage(root = process.cwd()): {
  rows: LedgerRow[];
  damaged: number;
} {
  try {
    return readLedgerLines(readFileSync(join(root, LEDGER_PATH), "utf8"));
  } catch {
    return { rows: [], damaged: 0 };
  }
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
  /** The tree identity every row in this run was written against. */
  readonly tree: string;
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

/** 1, 2, or refused. `attemptFor` is the whole of the one-re-run rule. */
export type Attempt = 1 | 2 | "capped";

/**
 * Which attempt this run of a check is, against this tree.
 *
 * Exactly one re-run. Green on it is a flake and owes a ticket; red again is a
 * finding; a third is refused. The rule is keyed on the *tree*, not on the
 * invocation, because that is what makes it enforceable: an ordinary second
 * `npm run gate` with nothing edited is the re-run, and there is no honest way
 * to ask a third time without changing something. An earlier version made the
 * re-run an opt-in flag, which capped only the path an agent volunteered into
 * and left plain repetition — the thing the rule forbids — entirely uncounted.
 */
export function attemptFor(
  rows: readonly LedgerRow[],
  name: string,
  tree: string,
): Attempt {
  const forTree = rows.filter((row) => row.name === name && row.tree === tree);
  const last = forTree[forTree.length - 1];
  // Green, skipped, or already recorded as a flake: nothing is being retried.
  if (!last || last.result !== "fail") return 1;
  return forTree.some((row) => row.attempt === 2) ? "capped" : 2;
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

export function newRunId(now: Date, tree: string): string {
  return `${now.toISOString().replace(/[:.]/g, "-")}-${tree}`;
}
