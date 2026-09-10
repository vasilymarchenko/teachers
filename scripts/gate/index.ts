/**
 * `npm run gate` — the one command that decides whether a change is checked,
 * and `npm run gate -- --report`, which decides whether it may be called done.
 *
 * It edits nothing and pushes nothing; `.gate/` is the only path it writes.
 *
 * **Nothing here ever refuses to run a check.** A check this machine cannot run
 * is `skipped` with the reason, in the table and in the pull request body, and
 * a skip is never reported as a pass. `--report` refuses a *conclusion* — a
 * refused measurement would block the recovery, because the check is what tells
 * the truth and an environment fix changes no file (T-029).
 */

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { selectChecks, unmetRequirement, type Check } from "./checks";
import { runHygiene } from "./hygiene";
import {
  appendLedger,
  counts,
  git,
  LAST_RUN_PATH,
  LEDGER_PATH,
  writeLastRun,
  type LedgerRow,
} from "./ledger";
import {
  countsLine,
  pullRequestBlock,
  table,
  type CheckOutcome,
} from "./report";

/**
 * The change under review: what the branch adds to `origin/main`, plus whatever
 * is not committed yet — the gate must see a fix before it is committed, or the
 * loop of phase 7 would need a commit per attempt.
 */
function changedFiles(): string[] {
  const committed =
    git(["diff", "--name-only", "origin/main...HEAD"]) ??
    // No `origin/main` — a fresh clone, or a detached checkout in CI.
    git(["diff", "--name-only", "HEAD"]) ??
    "";
  const uncommitted = git(["diff", "--name-only", "HEAD"]) ?? "";
  const untracked = git(["ls-files", "--others", "--exclude-standard"]) ?? "";
  return [
    ...new Set(
      [committed, uncommitted, untracked]
        .flatMap((block) => block.split("\n"))
        .filter((file) => file !== ""),
    ),
  ].sort();
}

/** The last 30 lines of a failure, which is where the reason usually is. */
function tail(output: string): string {
  return output.split("\n").slice(-30).join("\n");
}

function runCheck(check: Check, files: readonly string[]): CheckOutcome {
  const startedAt = Date.now();
  const skip = unmetRequirement(check);
  if (skip !== null) {
    return {
      name: check.name,
      result: "skipped",
      exitCode: null,
      durationMs: 0,
      reason: check.skipReason ?? skip,
    };
  }

  if (check.argv === null) {
    // The in-process checks. `hygiene` is the only one.
    const problems = runHygiene(files);
    return {
      name: check.name,
      result: problems.length === 0 ? "passed" : "failed",
      exitCode: problems.length === 0 ? 0 : 1,
      durationMs: Date.now() - startedAt,
      output: problems.join("\n"),
    };
  }

  const [command, ...args] = check.argv;
  const result = spawnSync(command, args, { encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return {
    name: check.name,
    result: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    output,
  };
}

function run(): number {
  const files = changedFiles();
  const commit = git(["rev-parse", "HEAD"]) ?? "unknown";
  const selected = selectChecks(files);
  const runId = `${new Date().toISOString()}-${randomUUID().slice(0, 8)}`;

  console.log(
    `gate: ${selected.length} checks for ${files.length} changed files on ${commit.slice(0, 7)}`,
  );

  const outcomes: CheckOutcome[] = [];
  for (const check of selected) {
    process.stdout.write(`  → ${check.name}\n`);
    // Every selected check runs. Short-circuiting is what turns one report into
    // three round-trips.
    outcomes.push(runCheck(check, files));
  }

  const at = new Date().toISOString();
  const rows: LedgerRow[] = outcomes.map((outcome) => ({
    runId,
    at,
    commit,
    check: outcome.name,
    result: outcome.result,
    exitCode: outcome.exitCode,
    ...(outcome.reason === undefined ? {} : { reason: outcome.reason }),
  }));
  appendLedger(rows);
  writeLastRun({ runId, at, commit, changedFiles: files, checks: outcomes });

  const failed = outcomes.filter((outcome) => outcome.result === "failed");
  for (const failure of failed) {
    console.log(`\n─── ${failure.name} ───\n${tail(failure.output ?? "")}`);
  }

  console.log(`\n${table(outcomes)}\n`);
  console.log(countsLine(counts()));
  console.log(`ledger: ${LEDGER_PATH} · last run: ${LAST_RUN_PATH}`);

  if (failed.length > 0) {
    console.log(`\n${failed.length} check(s) failed.`);
    return 1;
  }
  console.log("\nAll selected checks passed. Skips above are not passes.");
  return 0;
}

/**
 * `--report`: may this be called done? It runs no check — it reads what the
 * checks already said, the counts, and the pull request's own run.
 */
function report(): number {
  const blockers: string[] = [];

  for (const [name, count] of Object.entries(counts())) {
    if (count.exceeded) {
      blockers.push(
        `cap exceeded: ${name} is ${count.value}, cap is ${count.cap} (${count.derivation})`,
      );
    }
  }

  const ci = pullRequestChecks();
  console.log(`ci: ${ci.summary}`);
  if (ci.state !== "passing") {
    blockers.push(`CI on the pushed head: ${ci.summary}`);
  }

  console.log(countsLine(counts()));

  if (blockers.length > 0) {
    console.log(`\nNot done:\n${blockers.map((b) => `  - ${b}`).join("\n")}`);
    return 1;
  }
  console.log("\nNo cap exceeded and CI is green on the pushed head.");
  return 0;
}

/**
 * `gh pr checks` on the pushed head — the last gate, because `ci.yml` is the
 * authoritative one (ADR-007). Where `gh` cannot read it, this says so; it
 * never says it passed.
 */
function pullRequestChecks(): { state: string; summary: string } {
  const result = spawnSync("gh", ["pr", "checks", "--required"], {
    encoding: "utf8",
  });
  if (result.error !== undefined) {
    return { state: "unreadable", summary: "unreadable — gh is not available" };
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status === 0) return { state: "passing", summary: "green" };
  if (/pending|no checks/i.test(output)) {
    return { state: "pending", summary: `pending or absent — ${tail(output)}` };
  }
  if (/not found|no pull requests|authentication|auth/i.test(output)) {
    return { state: "unreadable", summary: `unreadable — ${tail(output)}` };
  }
  return { state: "failing", summary: `red — ${tail(output)}` };
}

const args = process.argv.slice(2);
if (args.includes("--pr-block")) {
  // Phase 6 pastes this into the pull request body.
  const commit = git(["rev-parse", "HEAD"]) ?? "unknown";
  const last = JSON.parse(readFileSync(LAST_RUN_PATH, "utf8")) as {
    checks: CheckOutcome[];
  };
  console.log(pullRequestBlock(last.checks, commit));
  process.exit(0);
}
process.exit(args.includes("--report") ? report() : run());
