import { describe, expect, it } from "vitest";

import {
  convergence,
  undisposed,
  validateFinding,
  type Finding,
  type FindingsFile,
  type Round,
} from "./findings";
import { MAX_REVIEW_ROUNDS } from "./ledger";

/**
 * The four dispositions and the loop's exit criterion.
 *
 * A finding that is merely "handled" is the shape phase 7 had before: the
 * agent's word for it. Each disposition here costs a piece of evidence, and the
 * one that costs the most is `rejected` — a reviewer's finding is refuted by
 * quoting the document, never by disagreeing with it.
 */

const open: Finding = {
  id: "R1-1",
  file: "lib/domain/schedule/expand.ts:42",
  rule: "architect-overview.md §8.5 — no new Date() in domain code",
  summary: "expand() reads the clock instead of taking today as an argument",
  source: "contract",
};

const round = (n: number, findings: readonly Finding[]): Round => ({
  round: n,
  at: "2026-09-09T12:00:00.000Z",
  commit: "abc1234",
  findings,
});

const file = (rounds: readonly Round[]): FindingsFile => ({
  ticket: "T-026",
  rounds,
});

describe("a disposition costs evidence", () => {
  it("accepts an open finding as complete but undisposed", () => {
    expect(validateFinding(open)).toEqual([]);
    expect(undisposed(round(1, [open]))).toHaveLength(1);
  });

  it("wants the commit or line that fixed it", () => {
    expect(validateFinding({ ...open, disposition: "fixed" })).toEqual([
      "R1-1: disposition \"fixed\" needs evidence",
    ]);
    expect(
      validateFinding({ ...open, disposition: "fixed", evidence: "def5678" }),
    ).toEqual([]);
  });

  it("wants the document text that refutes a rejected finding", () => {
    expect(validateFinding({ ...open, disposition: "rejected" })).toEqual([
      "R1-1: disposition \"rejected\" needs refutation",
    ]);
    expect(
      validateFinding({
        ...open,
        disposition: "rejected",
        refutation: "§8.5 restricts lib/domain; this line is in lib/db/schema",
      }),
    ).toEqual([]);
  });

  it("wants a real ticket id for a deferred finding", () => {
    expect(
      validateFinding({ ...open, disposition: "deferred", ticket: "later" }),
    ).toEqual(['R1-1: deferred to "later", which is not a T-NNN']);
    expect(
      validateFinding({ ...open, disposition: "deferred", ticket: "T-030" }),
    ).toEqual([]);
  });

  it("wants what the user said before it counts as accepted", () => {
    expect(validateFinding({ ...open, disposition: "accepted" })).toEqual([
      "R1-1: disposition \"accepted\" needs acceptedNote",
    ]);
  });

  it("rejects a disposition that is not one of the four", () => {
    const finding = { ...open, disposition: "wontfix" } as unknown as Finding;

    expect(validateFinding(finding)).toEqual([
      'R1-1: "wontfix" is not a disposition (fixed, rejected, deferred, accepted)',
    ]);
  });

  it("reports a finding that cannot say where or which rule", () => {
    const vague = { id: "R1-2", file: "", rule: "", summary: "", source: "contract" };

    expect(validateFinding(vague as Finding)).toEqual([
      "R1-2: file is missing",
      "R1-2: rule is missing",
      "R1-2: summary is missing",
    ]);
  });
});

describe("convergence", () => {
  it("counts the findings of each round, so two rounds can be compared", () => {
    const state = convergence(
      file([
        round(1, [
          { ...open, id: "R1-1", disposition: "fixed", evidence: "def5678" },
          { ...open, id: "R1-2", disposition: "deferred", ticket: "T-030" },
        ]),
        round(2, [{ ...open, id: "R2-1", disposition: "fixed", evidence: "9abcdef" }]),
      ]),
    );

    expect(state.counts).toEqual([2, 1]);
    expect(state.converged).toBe(true);
  });

  it("has not converged while the last round holds an open finding", () => {
    const state = convergence(file([round(1, [open])]));

    expect(state.openInLastRound).toBe(1);
    expect(state.converged).toBe(false);
  });

  it("converges on a round whose findings were all rejected", () => {
    // The review's evidence bar produces wrong findings on purpose. A round
    // that refutes every one of them has finished just as much as one that
    // fixed them all — otherwise the loop can only end by agreeing.
    const state = convergence(
      file([
        round(1, [
          { ...open, disposition: "rejected", refutation: "§8.5 does not cover lib/db" },
        ]),
      ]),
    );

    expect(state.converged).toBe(true);
  });

  it("has not converged before a first round has run", () => {
    expect(convergence(file([])).converged).toBe(false);
  });

  it("reports the round cap as reached only with findings still open", () => {
    const rounds = Array.from({ length: MAX_REVIEW_ROUNDS }, (_, i) => round(i + 1, []));

    expect(convergence(file(rounds)).cappedOut).toBe(false);
    expect(
      convergence(file([...rounds.slice(0, -1), round(MAX_REVIEW_ROUNDS, [open])]))
        .cappedOut,
    ).toBe(true);
  });

  it("orders rounds by their number, not by the order they were written", () => {
    const state = convergence(
      file([round(2, [open]), round(1, [{ ...open, disposition: "fixed", evidence: "x" }])]),
    );

    expect(state.counts).toEqual([1, 1]);
    expect(state.openInLastRound).toBe(1);
  });

  it("refuses to call a file with an unevidenced disposition converged", () => {
    const state = convergence(file([round(1, [{ ...open, disposition: "fixed" }])]));

    expect(state.converged).toBe(false);
    expect(state.problems).toEqual([
      'round 1: R1-1: disposition "fixed" needs evidence',
    ]);
  });
});
