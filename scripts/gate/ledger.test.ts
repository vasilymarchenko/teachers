import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  appendLedger,
  gateRunsSince,
  pushesAfterOpeningFrom,
  readLedger,
  readRounds,
  type LedgerRow,
} from "./ledger";

/**
 * `.gate/` is memory, not enforcement (T-029): a session resumed after a
 * compacted context reads it and carries on instead of re-attesting from a
 * conversation it no longer has. Nothing here refuses anything.
 *
 * Every case runs against a temporary directory. A test that appended to the
 * repository's own `.gate/ledger.jsonl` would corrupt the count the loop it is
 * testing then reads.
 */

const dir = () => mkdtempSync(join(tmpdir(), "gate-"));

const row = (over: Partial<LedgerRow> = {}): LedgerRow => ({
  runId: "run-1",
  at: "2026-09-10T10:00:00.000Z",
  commit: "abc1234",
  check: "lint",
  result: "passed",
  exitCode: 0,
  ...over,
});

describe("the ledger", () => {
  it("appends one row per check, carrying all five fields", () => {
    const at = dir();
    appendLedger([row(), row({ check: "test", result: "failed", exitCode: 1 })], at);

    const rows = readLedger(at);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      runId: "run-1",
      at: "2026-09-10T10:00:00.000Z",
      commit: "abc1234",
      check: "test",
      result: "failed",
      exitCode: 1,
    });
  });

  it("appends rather than replacing, across runs", () => {
    const at = dir();
    appendLedger([row()], at);
    appendLedger([row({ runId: "run-2" })], at);
    expect(readLedger(at)).toHaveLength(2);
  });

  it("reads a ledger that does not exist as empty, not as an error", () => {
    expect(readLedger(dir())).toEqual([]);
  });

  it("skips a half-written line rather than taking the gate down", () => {
    const at = dir();
    appendLedger([row()], at);
    writeFileSync(join(at, "ledger.jsonl"), '{"runId":"run-2","che\n', { flag: "a" });
    appendLedger([row({ runId: "run-3" })], at);

    expect(readLedger(at).map((r) => r.runId)).toEqual(["run-1", "run-3"]);
  });
});

describe("gate runs in the current round", () => {
  const rows = [
    row({ runId: "before", at: "2026-09-10T09:00:00.000Z" }),
    row({ runId: "first", at: "2026-09-10T11:00:00.000Z" }),
    row({ runId: "first", at: "2026-09-10T11:00:00.000Z", check: "test" }),
    row({ runId: "second", at: "2026-09-10T12:00:00.000Z" }),
  ];

  it("counts one run of many checks as one run", () => {
    // The cap bounds attempts, not checks — a run of five checks that all fail
    // is one attempt at the change, not five.
    expect(gateRunsSince("2026-09-10T10:00:00.000Z", rows)).toBe(2);
  });

  it("does not count a run from before the round started", () => {
    expect(gateRunsSince("2026-09-10T11:30:00.000Z", rows)).toBe(1);
  });

  it("is zero on an empty ledger", () => {
    expect(gateRunsSince("2026-09-10T10:00:00.000Z", [])).toBe(0);
  });
});

describe("the rounds in findings.json", () => {
  const write = (body: string) => {
    const at = dir();
    writeFileSync(join(at, "findings.json"), body, "utf8");
    return at;
  };

  it("reads the round number, its start and its head", () => {
    const at = write(
      JSON.stringify({
        rounds: [{ round: 1, startedAt: "2026-09-10T11:00:00.000Z", head: "abc" }],
      }),
    );
    expect(readRounds(at)).toEqual([
      { round: 1, startedAt: "2026-09-10T11:00:00.000Z", head: "abc" },
    ]);
  });

  it("orders by round number, not by the order they were written", () => {
    const at = write(
      JSON.stringify({
        rounds: [
          { round: 2, startedAt: "2026-09-10T12:00:00.000Z" },
          { round: 1, startedAt: "2026-09-10T11:00:00.000Z" },
        ],
      }),
    );
    expect(readRounds(at).map((round) => round.round)).toEqual([1, 2]);
  });

  it("treats a missing, malformed or shapeless file as no round started", () => {
    // The file is agent-written, and nothing validates it — a validator can
    // check that a field is not empty, never that it is true. What it must not
    // do is take the gate down on the way to a check.
    expect(readRounds(dir())).toEqual([]);
    expect(readRounds(write("{ not json"))).toEqual([]);
    expect(readRounds(write("{}"))).toEqual([]);
    expect(readRounds(write(JSON.stringify({ rounds: [{ round: "one" }] })))).toEqual([]);
  });

  it("ignores the findings themselves — it reads only the round's frame", () => {
    const at = write(
      JSON.stringify({
        rounds: [
          {
            round: 1,
            startedAt: "2026-09-10T11:00:00.000Z",
            findings: [{ id: "R1-1", disposition: "nonsense" }],
          },
        ],
      }),
    );
    expect(readRounds(at)).toHaveLength(1);
  });
});

describe("pushes after the one that opened the pull request", () => {
  // `git reflog show --format=%H` is newest first. A clone's fetch creates the
  // ref before the opening push updates it, so the oldest entry is not the
  // opening push and "all but the oldest" over-counts by one.
  const reflog = ["ccc3333", "bbb2222", "aaa1111", "aaa1111"];

  it("counts nothing when the opening head is still the newest entry", () => {
    expect(pushesAfterOpeningFrom(["aaa1111", "aaa1111"], "aaa1111")).toBe(0);
  });

  it("counts the entries newer than the opening head", () => {
    expect(pushesAfterOpeningFrom(reflog, "aaa1111")).toBe(2);
    expect(pushesAfterOpeningFrom(reflog, "bbb2222")).toBe(1);
  });

  it("matches an abbreviated head against the full sha", () => {
    expect(pushesAfterOpeningFrom(["ccc3333333", "aaa1111111"], "aaa1111")).toBe(1);
  });

  it("says it cannot tell rather than guessing, when the head is absent", () => {
    // A fresh clone in a resumed session: the caller falls back to counting
    // commits and prints which derivation it used.
    expect(pushesAfterOpeningFrom(reflog, "ddd4444")).toBeNull();
    expect(pushesAfterOpeningFrom([], "aaa1111")).toBeNull();
  });
});
