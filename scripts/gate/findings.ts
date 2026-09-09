/**
 * Findings, their dispositions, and whether the review loop has converged.
 *
 * `/teachers-review` produces findings; `/teachers-ticket` phase 7 disposes of
 * them. Four dispositions, not two: the review's evidence bar
 * (`teachers-review/SKILL.md` phase 5) exists to produce *wrong* findings and
 * kill them, so "the document does not say that" has to be a recordable
 * outcome, not a silence.
 *
 * The loop's exit criterion is computed here rather than asserted in prose: a
 * round is a list, two rounds can be compared, and a round with nothing
 * undisposed is the end. ADR-011.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { FINDINGS_PATH, MAX_REVIEW_ROUNDS } from "./ledger";

export const DISPOSITIONS = ["fixed", "rejected", "deferred", "accepted"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export type Finding = {
  /** Stable within the ledger, e.g. `R1-3`. */
  readonly id: string;
  /** Where — `path:line`, as the review's own evidence bar requires. */
  readonly file: string;
  /** The rule, quoted from the document it comes from. */
  readonly rule: string;
  /** One sentence: the defect. */
  readonly summary: string;
  /** Which pass found it, so a defect found by both is reconciled to one row. */
  readonly source: "contract" | "code-review" | "architecture" | "gate";
  /** Absent while the finding is still open. */
  readonly disposition?: Disposition;
  /** `fixed`: the commit or `file:line` that fixes it. */
  readonly evidence?: string;
  /** `rejected`: the document text that refutes the rule the reviewer quoted. */
  readonly refutation?: string;
  /** `deferred`: the ticket it went to. */
  readonly ticket?: string;
  /** `accepted`: what the user said, and when. */
  readonly acceptedNote?: string;
};

export type Round = {
  readonly round: number;
  readonly at: string;
  readonly commit: string;
  readonly findings: readonly Finding[];
};

export type FindingsFile = {
  readonly ticket: string;
  readonly rounds: readonly Round[];
};

/**
 * What each disposition has to carry to count as recorded.
 *
 * A disposition with no evidence is the same self-attestation the ledger exists
 * to replace — "I fixed it" is a claim, a commit is a row.
 */
const EVIDENCE_FIELD: Record<Disposition, keyof Finding> = {
  fixed: "evidence",
  rejected: "refutation",
  deferred: "ticket",
  accepted: "acceptedNote",
};

const TICKET_ID = /^T-\d{3}$/;

export function validateFinding(finding: Finding): string[] {
  const problems: string[] = [];
  const where = finding.id || finding.file || "(unidentified finding)";

  for (const field of ["id", "file", "rule", "summary", "source"] as const) {
    if (!finding[field]) problems.push(`${where}: ${field} is missing`);
  }

  const disposition = finding.disposition;
  if (disposition === undefined) return problems;

  if (!DISPOSITIONS.includes(disposition)) {
    problems.push(
      `${where}: "${disposition}" is not a disposition (${DISPOSITIONS.join(", ")})`,
    );
    return problems;
  }

  const field = EVIDENCE_FIELD[disposition];
  if (!finding[field]) {
    problems.push(`${where}: disposition "${disposition}" needs ${field}`);
  }
  if (disposition === "deferred" && finding.ticket && !TICKET_ID.test(finding.ticket)) {
    problems.push(`${where}: deferred to "${finding.ticket}", which is not a T-NNN`);
  }
  return problems;
}

export function undisposed(round: Round): readonly Finding[] {
  return round.findings.filter((finding) => finding.disposition === undefined);
}

export type Convergence = {
  readonly rounds: number;
  /** Findings per round, oldest first — the countable form the loop compares. */
  readonly counts: readonly number[];
  readonly openInLastRound: number;
  /** True when the last round found nothing left undisposed. */
  readonly converged: boolean;
  /** True when the round cap was reached without converging. */
  readonly cappedOut: boolean;
  readonly problems: readonly string[];
};

/**
 * The loop's exit criterion, computed.
 *
 * Converged means the *latest* round has no undisposed finding — not that the
 * latest round was empty. A round whose every finding was rejected with the
 * document text that refutes it has converged just as much as one that fixed
 * them all; that is what makes "the reviewer was wrong" an outcome the loop can
 * end on rather than one it has to argue its way out of.
 */
export function convergence(file: FindingsFile): Convergence {
  const problems: string[] = [];
  const rounds = [...file.rounds].sort((a, b) => a.round - b.round);

  if (!file.ticket) problems.push("the findings file names no ticket");
  for (const round of rounds) {
    for (const finding of round.findings) {
      problems.push(...validateFinding(finding).map((p) => `round ${round.round}: ${p}`));
    }
  }

  const last = rounds[rounds.length - 1];
  const open = last ? undisposed(last).length : 0;

  return {
    rounds: rounds.length,
    counts: rounds.map((round) => round.findings.length),
    openInLastRound: open,
    converged: rounds.length > 0 && open === 0 && problems.length === 0,
    cappedOut: rounds.length >= MAX_REVIEW_ROUNDS && open > 0,
    problems,
  };
}

export function readFindings(root = process.cwd()): FindingsFile | null {
  try {
    return JSON.parse(readFileSync(join(root, FINDINGS_PATH), "utf8")) as FindingsFile;
  } catch {
    return null;
  }
}

export function writeFindings(file: FindingsFile, root = process.cwd()): void {
  const path = join(root, FINDINGS_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
}
