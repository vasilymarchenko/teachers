import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CHECKS, selectChecks } from "./checks";

/**
 * The gate and CI have one definition of "checked", and this is what holds them
 * to it (ADR-011).
 *
 * `.github/workflows/ci.yml` stays the authoritative gate — ADR-007 — and it is
 * deliberately not made to call `npm run gate`: its jobs split on purpose, the
 * integration job for a `services:` Postgres and the images job for buildx, and
 * collapsing them would cost that parallelism. So the two are held in step the
 * way `lib/db/postgresImage.test.ts` holds one Postgres version across three
 * files: neither generates the other, they simply have to match, and a check
 * says so. A check added to CI and not to `checks.ts` fails here.
 *
 * The relationship is coverage, not equality: the gate may be *wider* than CI —
 * `diff-hygiene` is about a change rather than a commit, so CI has nothing to
 * run for it — but never narrower. A gate-only check declares itself with
 * `ci: null` and has to be listed below, so widening is a decision somebody
 * took rather than a check that quietly stopped matching.
 */

const CI = readFileSync(".github/workflows/ci.yml", "utf8");

/** Checks the gate has and CI does not. Adding to this list is the decision. */
const GATE_ONLY = ["diff-hygiene"];

/**
 * Every npm script `ci.yml` runs, normalised to how it is invoked.
 *
 * `npm ci` is installation, not a check, and is deliberately not matched: the
 * pattern requires either `run` or the one script npm accepts bare.
 */
export function npmScriptsIn(source: string): string[] {
  const run = [...source.matchAll(/\bnpm run ([\w:.-]+)/g)].map(
    ([, script]) => `npm run ${script}`,
  );
  const bare = [...source.matchAll(/\bnpm test\b/g)].map(() => "npm test");
  return [...run, ...bare];
}

/** Every Docker build target `ci.yml` builds — the `target:` key of a build step. */
export function buildTargetsIn(source: string): string[] {
  return [...source.matchAll(/^[ \t]*target:[ \t]*([\w.-]+)[ \t]*$/gm)].map(
    ([, target]) => `target: ${target}`,
  );
}

/** Every SQL script under `scripts/` that `ci.yml` executes. */
export function sqlScriptsIn(source: string): string[] {
  return [...source.matchAll(/\bscripts\/[\w.-]+\.sql\b/g)].map(([match]) => match);
}

const unique = (values: readonly string[]) => [...new Set(values)].sort();

const claimed = CHECKS.map((check) => check.ci).filter(
  (ci): ci is string => ci !== null,
);
const claimedOfShape = (predicate: (ci: string) => boolean) =>
  unique(claimed.filter(predicate));

describe("the gate covers what ci.yml runs", () => {
  it("names the same npm scripts", () => {
    expect(claimedOfShape((ci) => ci.startsWith("npm "))).toEqual(
      unique(npmScriptsIn(CI)),
    );
  });

  it("names the same Docker build targets", () => {
    expect(claimedOfShape((ci) => ci.startsWith("target: "))).toEqual(
      unique(buildTargetsIn(CI)),
    );
  });

  it("names the same SQL scripts", () => {
    expect(claimedOfShape((ci) => ci.endsWith(".sql"))).toEqual(
      unique(sqlScriptsIn(CI)),
    );
  });

  it("claims nothing that ci.yml does not contain", () => {
    // Catches the markers the three extractors above cannot generalise — the
    // migrator smoke test is claimed by the image tag CI runs it under, and a
    // rename there would otherwise leave the gate standing for nothing.
    expect(claimed.filter((ci) => !CI.includes(ci))).toEqual([]);
  });

  it("has a gate-only check only where one was declared", () => {
    expect(CHECKS.filter((check) => check.ci === null).map((check) => check.name)).toEqual(
      GATE_ONLY,
    );
  });

  it("gives every check a distinct name and every CI step one claimant", () => {
    expect(unique(CHECKS.map((check) => check.name))).toHaveLength(CHECKS.length);
    expect(unique(claimed)).toHaveLength(claimed.length);
  });
});

describe("routing", () => {
  const names = (paths: string[]) => selectChecks(paths).map((check) => check.name);

  it("always runs lint, typecheck, test, build and diff-hygiene", () => {
    expect(names(["docs/backlog/README.md"])).toEqual([
      "lint",
      "typecheck",
      "test",
      "build",
      "diff-hygiene",
    ]);
  });

  it("adds the database checks for lib/db and drizzle", () => {
    for (const path of ["lib/db/schema/event.ts", "drizzle/0003_thing.sql"]) {
      expect(names([path])).toContain("db:migrate");
      expect(names([path])).toContain("verify-schema");
      expect(names([path])).toContain("test:integration");
    }
  });

  it("adds them for the assertion they are checked by, too", () => {
    // Wider than the ticket's routing on purpose: a weakened
    // `verify-schema.sql` that nobody runs is the one edit that silently
    // removes a check rather than failing one.
    expect(names(["scripts/verify-schema.sql"])).toContain("verify-schema");
  });

  it("adds the image checks for the Dockerfile and either compose file", () => {
    for (const path of [
      "Dockerfile",
      "docker-compose.yml",
      "docker-compose.prod.yml",
    ]) {
      expect(names([path])).toContain("image:runner");
      expect(names([path])).toContain("image:migrator");
      expect(names([path])).toContain("migrator-smoke");
    }
  });

  it("does not confuse a neighbouring path for a routed one", () => {
    // `lib/domain` is not `lib/db`, and a Dockerfile in a subdirectory is not
    // the one the images are built from.
    expect(names(["lib/domain/schedule/expand.ts"])).not.toContain("test:integration");
    expect(names(["docs/Dockerfile"])).not.toContain("image:runner");
    expect(names(["lib/dbutils/thing.ts"])).not.toContain("db:migrate");
  });
});

describe("the extractors themselves", () => {
  it("read each shape ci.yml actually uses", () => {
    expect(npmScriptsIn("      - run: npm run lint\n")).toEqual(["npm run lint"]);
    expect(npmScriptsIn("      - run: npm test\n")).toEqual(["npm test"]);
    expect(npmScriptsIn("      - run: npm run test:integration\n")).toEqual([
      "npm run test:integration",
    ]);
    expect(buildTargetsIn("        with:\n          target: runner\n")).toEqual([
      "target: runner",
    ]);
    expect(sqlScriptsIn('psql "$DATABASE_URL" -f scripts/verify-schema.sql\n')).toEqual([
      "scripts/verify-schema.sql",
    ]);
  });

  it("ignores npm ci, which installs rather than checks", () => {
    expect(npmScriptsIn("      - run: npm ci\n")).toEqual([]);
  });

  it("does not mistake prose for a step", () => {
    // Without this the comment blocks in ci.yml — which discuss the jobs at
    // length — would contribute steps nobody runs.
    expect(buildTargetsIn("      # the target: runner image is not pushed here\n")).toEqual(
      [],
    );
    expect(sqlScriptsIn("# drizzle/0002_exclusion_constraints.sql is hand written\n")).toEqual(
      [],
    );
  });

  it("would notice a step ci.yml gained", () => {
    expect(npmScriptsIn("      - run: npm run audit:licences\n")).toEqual([
      "npm run audit:licences",
    ]);
    expect(buildTargetsIn("          target: worker\n")).toEqual(["target: worker"]);
  });
});
