/**
 * `.gate/` — everything the gate writes, and the counts derived back out of it.
 *
 * The directory is gitignored and is the only path the gate writes. It lives in
 * the repository rather than a session scratchpad because a human running
 * `npm run gate` in a terminal has no scratchpad path, and a fresh session
 * could not find the previous one (T-029, carried over from T-026).
 *
 * **The ledger is memory, not enforcement.** Nothing here refuses to run a
 * check on account of what it says. A session resumed after a compacted
 * context reads it and carries on instead of re-attesting from a conversation
 * it no longer has — that, and nothing more.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CAPS } from "./caps";

export const GATE_DIR = ".gate";
export const LEDGER_PATH = join(GATE_DIR, "ledger.jsonl");
export const LAST_RUN_PATH = join(GATE_DIR, "last-run.json");
export const FINDINGS_PATH = join(GATE_DIR, "findings.json");

export type CheckResult = "passed" | "failed" | "skipped";

/** One check, in one run. The unit of both files below. */
export interface LedgerRow {
  runId: string;
  at: string;
  commit: string;
  check: string;
  result: CheckResult;
  /** `null` for a check that never started, or one that ran in-process. */
  exitCode: number | null;
  reason?: string;
}

export function appendLedger(rows: readonly LedgerRow[], dir = GATE_DIR): void {
  mkdirSync(dir, { recursive: true });
  appendFileSync(
    join(dir, "ledger.jsonl"),
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf8",
  );
}

export function writeLastRun(run: unknown, dir = GATE_DIR): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "last-run.json"),
    JSON.stringify(run, null, 2) + "\n",
    "utf8",
  );
}

/**
 * Every row the ledger can be read as. A line that does not parse is skipped
 * rather than fatal: the ledger is append-only from several sessions, and a
 * truncated write must not take the gate down with it.
 */
export function readLedger(dir = GATE_DIR): LedgerRow[] {
  let text: string;
  try {
    text = readFileSync(join(dir, "ledger.jsonl"), "utf8");
  } catch {
    return [];
  }
  const rows: LedgerRow[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    try {
      rows.push(JSON.parse(line) as LedgerRow);
    } catch {
      // A half-written line. Skip it.
    }
  }
  return rows;
}

/** One review round, as `/teachers-ticket` phase 7 records it. */
export interface Round {
  round: number;
  startedAt: string;
  /** The head the round opened against — what the push count counts from. */
  head?: string;
}

/**
 * The rounds recorded in `.gate/findings.json`, or `[]`.
 *
 * Deliberately tolerant, and deliberately narrow: it reads `round`,
 * `startedAt` and `head` and ignores everything else in the file. **Nothing
 * validates the findings.** A validator can check that a field is not empty,
 * never that it is true — T-026's own second round recorded a finding `fixed`
 * on evidence naming code that did not exist, with a validator in place.
 */
export function readRounds(dir = GATE_DIR): Round[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(dir, "findings.json"), "utf8"));
  } catch {
    return [];
  }
  const rounds = (parsed as { rounds?: unknown })?.rounds;
  if (!Array.isArray(rounds)) return [];
  return rounds
    .filter(
      (round): round is Round =>
        typeof round?.round === "number" && typeof round?.startedAt === "string",
    )
    .sort((a, b) => a.round - b.round);
}

/** Distinct gate invocations the ledger carries at or after `since`. */
export function gateRunsSince(
  since: string,
  rows: readonly LedgerRow[],
): number {
  return new Set(
    rows.filter((row) => row.at >= since).map((row) => row.runId),
  ).size;
}

export interface Count {
  value: number;
  cap: number;
  /** How the number was arrived at — printed, so no one has to guess. */
  derivation: string;
  exceeded: boolean;
}

function count(value: number, cap: number, derivation: string): Count {
  return { value, cap, derivation, exceeded: value > cap };
}

/**
 * The three counts, each derived from a record the agent did not author
 * wherever one exists. Only the round *number* is agent-written, in
 * `findings.json` — a count held in the conversation is not a count, because
 * a compacted context is guaranteed to take it.
 */
export function counts(dir = GATE_DIR): Record<string, Count> {
  const rounds = readRounds(dir);
  const current = rounds.at(-1);
  const rows = readLedger(dir);

  return {
    reviewRounds: count(
      rounds.length,
      CAPS.reviewRounds,
      rounds.length === 0
        ? "no round recorded in .gate/findings.json yet"
        : `rounds recorded in ${FINDINGS_PATH}`,
    ),
    gateRunsThisRound: current
      ? count(
          gateRunsSince(current.startedAt, rows),
          CAPS.gateRunsPerRound,
          `distinct run ids in ${LEDGER_PATH} since ${current.startedAt}`,
        )
      : count(0, CAPS.gateRunsPerRound, "phase 7 has not started a round"),
    pushesAfterOpening: pushCount(current === undefined ? undefined : rounds[0]),
  };
}

/**
 * Pushes to the pull request after the one that opened it.
 *
 * From the reflog of the remote-tracking ref: git writes one entry there per
 * update of `origin/<branch>`, and the first is the one that created it — the
 * push that opened the pull request, or the fetch that first saw the branch.
 * A fetch that moves the ref also lands there, so this can over-count on a
 * branch someone else pushes to; this repository has no such branch, and
 * anything more exact would need a record the agent writes itself.
 *
 * Where the reflog is empty — a fresh clone in a resumed session — it falls
 * back to counting commits since the head the first round opened against.
 */
function pushCount(firstRound: Round | undefined): Count {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const ref = `refs/remotes/origin/${branch}`;
  const reflog = git(["reflog", "show", "--format=%H", ref]);

  if (reflog !== null && reflog !== "") {
    const updates = reflog.split("\n").filter((line) => line !== "").length;
    return count(
      Math.max(0, updates - 1),
      CAPS.pushesAfterOpening,
      `${ref} reflog updates after the first`,
    );
  }

  const head = firstRound?.head;
  if (head === undefined) {
    return count(0, CAPS.pushesAfterOpening, "no reflog and no round 1 head");
  }
  const commits = git(["rev-list", "--count", `${head}..HEAD`]);
  return count(
    commits === null ? 0 : Number(commits),
    CAPS.pushesAfterOpening,
    `commits since round 1's head ${head.slice(0, 7)} (no reflog)`,
  );
}

export function git(args: readonly string[]): string | null {
  const result = spawnSync("git", [...args], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}
