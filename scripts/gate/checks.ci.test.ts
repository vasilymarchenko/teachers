import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CHECKS, type Check } from "./checks";

/**
 * The gate's check list and `.github/workflows/ci.yml` are two definitions of
 * one thing, and they have to agree.
 *
 * `ci.yml` is the authoritative gate (ADR-007): a change that is green locally
 * and red there cost the developer a round-trip, and before T-029 exactly that
 * was possible — `npm run build` and `scripts/verify-schema.sql` were in the
 * workflow and in neither skill. Neither file generates the other; this test is
 * what holds them level. Same shape as `lib/db/postgresImage.test.ts`, and the
 * reasoning is `docs/architecture/decisions/ADR-012-one-check-definition.md`.
 *
 * **Scoped to the three gate jobs, not to the whole workflow.** `publish` runs
 * npm nothing today, but a future job that runs an npm script for some other
 * purpose — a docs build, a release note — must not have to become a gate check
 * to keep this suite green.
 *
 * **One divergence is deliberate, and `where the gate deliberately checks less`
 * below is where it is declared.** `test` and `build` carry `kinds: ["code"]`,
 * so the gate routes them away from a diff of prose while `ci.yml`'s `checks`
 * job runs them on every push (T-037, `ADR-016`). Set equality above is
 * untouched by that — both files still hold the same four scripts — and the
 * property that keeps the divergence safe is asserted here instead: the push
 * trigger carries no path filter, so the checks the gate routed away are run
 * against the commit before anything can be merged. The day a `paths:` filter
 * appears on that trigger the two definitions really do differ, and this test
 * is what makes someone say so.
 *
 * There is no YAML parser in this project and this does not justify adding one:
 * the file is sliced at its job headers instead. That is a few lines more than
 * matching the whole file, and it is the reason to prefer it — a whole-file
 * match cannot tell one job's steps from another's, which is exactly the
 * distinction the scoping above rests on.
 */

const WORKFLOW = ".github/workflows/ci.yml";

/** The jobs that make up the gate. `publish` is not one — it publishes. */
const GATE_JOBS = ["checks", "integration", "images"] as const;

/**
 * `npm ci` installs; it does not check anything. It is the only npm invocation
 * in a gate job that is not a gate check, and it is allowlisted by name rather
 * than by a pattern, so a second one would have to be added deliberately.
 */
const SETUP_SCRIPTS = new Set(["ci"]);

/**
 * Every job in the workflow, as text.
 *
 * Slicing starts at the `jobs:` line, so the two-space keys of the top-level
 * `concurrency:` and `env:` blocks are never mistaken for job names, and a job
 * header is a two-space key with nothing after the colon — every key inside a
 * job is indented four or more.
 */
export function jobSlices(source: string): Map<string, string> {
  const slices = new Map<string, string>();
  const lines = source.split("\n");
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (start === -1) return slices;

  let name: string | null = null;
  let body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const header = /^ {2}([A-Za-z][\w-]*):\s*$/.exec(line);
    if (header !== null) {
      if (name !== null) slices.set(name, body.join("\n"));
      name = header[1];
      body = [];
      continue;
    }
    body.push(line);
  }
  if (name !== null) slices.set(name, body.join("\n"));
  return slices;
}

/**
 * The npm scripts a job runs. `npm test` and `npm run test` are the same
 * script under two spellings, and `ci.yml` uses the short one.
 */
export function npmScriptsIn(job: string): string[] {
  return [...job.matchAll(/\bnpm (?:run\s+([\w:-]+)|(test|ci)\b)/g)].map(
    ([, script, shorthand]) => script ?? shorthand,
  );
}

const workflow = readFileSync(WORKFLOW, "utf8");
const slices = jobSlices(workflow);
const gateChecks = (job: string): Check[] =>
  CHECKS.filter((check) => check.ciJob === job);

describe(`the gate and ${WORKFLOW}`, () => {
  it("finds every job, so a rename cannot empty this test", () => {
    // Without this, a renamed job would turn every comparison below into two
    // empty sets, which agree trivially.
    expect([...slices.keys()]).toEqual([...GATE_JOBS, "publish"]);
  });

  for (const job of GATE_JOBS) {
    it(`slices ${job} without taking in another job's steps`, () => {
      expect(slices.get(job)?.length ?? 0).toBeGreaterThan(0);
      // `docker/login-action` is `publish`'s alone — it is the one step that
      // holds a registry credential, and no gate job may contain it.
      expect(slices.get(job)).not.toContain("docker/login-action");
    });
  }

  for (const job of GATE_JOBS) {
    it(`runs no npm script in ${job} that the gate does not check`, () => {
      const inCi = npmScriptsIn(slices.get(job) ?? "").filter(
        (script) => !SETUP_SCRIPTS.has(script),
      );
      const inGate = gateChecks(job).flatMap((check) =>
        check.ciScript === undefined ? [] : [check.ciScript],
      );

      expect([...new Set(inCi)].sort()).toEqual([...new Set(inGate)].sort());
    });
  }

  it("routes a check for every non-npm step the gate claims to cover", () => {
    // The other direction cannot be enumerated: a `run:` block is arbitrary
    // shell, so a check that names a step names the substring that identifies
    // it, and this asserts the substring is still there.
    const missing = CHECKS.filter(
      (check) =>
        check.ciAnchor !== undefined &&
        !(slices.get(check.ciJob ?? "") ?? "").includes(check.ciAnchor),
    ).map((check) => `${check.name} → ${check.ciAnchor}`);

    expect(missing).toEqual([]);
  });

  it("claims a job for every check that has one, and none for hygiene", () => {
    const jobs = new Set(
      CHECKS.flatMap((check) =>
        check.ciJob === undefined ? [] : [check.ciJob],
      ),
    );
    expect([...jobs].sort()).toEqual([...GATE_JOBS].sort());
    // The three things it looks for are properties of a diff, and CI checks
    // out a commit rather than reviewing one.
    expect(
      CHECKS.find((check) => check.name === "hygiene")?.ciJob,
    ).toBeUndefined();
  });
});

describe("where the gate deliberately checks less than ci.yml", () => {
  /** Everything above `jobs:` — `on:`, `concurrency:`, `env:`, `permissions:`. */
  const trigger = workflow.slice(0, workflow.indexOf("\njobs:"));

  it("declares every check the gate routes by kind", () => {
    // Named, not counted. A third one added silently is the failure this
    // assertion exists to catch: the divergence is allowed because it is
    // declared here and argued in ADR-016, and a check that slipped in without
    // either would be the gate quietly checking less than CI.
    const byKind = CHECKS.filter((check) => check.kinds !== undefined);
    expect(byKind.map((check) => check.name)).toEqual(["test", "build"]);
    for (const check of byKind) {
      expect(check.kinds).toEqual(["code"]);
      // The job that runs it unconditionally, which is what makes the routing
      // safe — and what the skip reason names in the table and the PR body.
      expect(check.ciJob).toBe("checks");
    }
  });

  it("runs the checks job on every push, with no path filter on the trigger", () => {
    // ADR-016's whole premise. A `paths:` or `paths-ignore:` here would mean a
    // documentation change runs `test` and `build` in neither place, and the
    // gate's skip reason — "ci.yml `checks` runs it on every push" — would be
    // a false statement printed on every run.
    expect(trigger).toMatch(/^on:$/m);
    expect(trigger).toMatch(/^ {2}push:$/m);
    expect(trigger).not.toMatch(/^\s+paths(-ignore)?:/m);
    // The slice really is the trigger block and not the whole file, or the
    // assertion above would be vacuous the moment `jobs:` moved.
    expect(trigger).not.toContain("runs-on:");
  });

  it("puts no condition on the checks job itself", () => {
    // A job-level `if:` would skip the whole job for some commits, which is the
    // same hole as a path filter on the trigger by another route.
    expect(slices.get("checks")).not.toMatch(/^ {4}if:/m);
  });
});

describe("the slicer itself", () => {
  const synthetic = [
    "concurrency:",
    "  group: ci-main",
    "env:",
    "  POSTGRES_IMAGE: postgres:16-alpine",
    "jobs:",
    "  first:",
    "    steps:",
    "      - run: npm ci",
    "      - run: npm run lint",
    "  second:",
    "    services:",
    "      postgres:",
    "        image: postgres:16-alpine",
    "    steps:",
    "      - run: npm test",
    "  third:",
    "    steps:",
    "      - uses: docker/build-push-action@v6",
    "  publish:",
    "    needs: [first, second, third]",
    "    steps:",
    "      - uses: docker/login-action@v3",
    "      - run: npm run release-notes",
    "",
  ].join("\n");

  it("cuts at job headers and nowhere else", () => {
    const cut = jobSlices(synthetic);
    expect([...cut.keys()]).toEqual(["first", "second", "third", "publish"]);
    // `postgres:` is a two-space-looking key at eight spaces — a whole-file
    // match would have made it a third job.
    expect(cut.get("second")).toContain("image: postgres:16-alpine");
  });

  it("does not bleed one job's steps into the next", () => {
    const cut = jobSlices(synthetic);
    expect(npmScriptsIn(cut.get("first") ?? "")).toEqual(["ci", "lint"]);
    expect(npmScriptsIn(cut.get("second") ?? "")).toEqual(["test"]);
    expect(npmScriptsIn(cut.get("third") ?? "")).toEqual([]);
  });

  it("keeps a non-gate job's npm script out of the gate jobs entirely", () => {
    // The whole point of slicing rather than matching the file: `publish` runs
    // `npm run release-notes`, and no gate job may be made to answer for it.
    const cut = jobSlices(synthetic);
    expect(npmScriptsIn(cut.get("publish") ?? "")).toEqual(["release-notes"]);
    for (const job of ["first", "second", "third"]) {
      expect(npmScriptsIn(cut.get(job) ?? "")).not.toContain("release-notes");
    }
  });

  it("ignores everything above `jobs:`", () => {
    expect(jobSlices(synthetic).has("group")).toBe(false);
    expect(jobSlices("name: CI\non:\n  push:\n")).toEqual(new Map());
  });

  it("reads both spellings of the unit suite", () => {
    expect(
      npmScriptsIn("- run: npm test\n- run: npm run test:integration"),
    ).toEqual(["test", "test:integration"]);
  });
});
