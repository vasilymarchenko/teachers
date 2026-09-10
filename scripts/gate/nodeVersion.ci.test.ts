import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { requiredNodeMajor, unsupportedNodeVersion } from "./nodeVersion";

/**
 * The Node major version is named three times, and they have to agree.
 *
 * `.nvmrc` is what `nvm use` reads, `package.json`'s `engines.node` is what
 * `npm install` warns about, and `.github/workflows/ci.yml`'s two
 * `node-version: 22` lines are what the runner installs. A skew between them
 * is the gap T-031 closes: two files a developer's shell can read and one
 * that nothing compared. Same shape as `lib/db/postgresImage.test.ts`, and
 * `scripts/gate/checks.ci.test.ts` for the `ci.yml` half.
 */

const PACKAGE_JSON = "package.json";
const WORKFLOW = ".github/workflows/ci.yml";

function ciNodeMajors(source: string): number[] {
  return [...source.matchAll(/node-version:\s*["']?(\d+)["']?/g)].map(
    ([, major]) => Number.parseInt(major, 10),
  );
}

function engineNodeMajor(source: string): number {
  const pkg = JSON.parse(source) as { engines?: { node?: string } };
  const range = pkg.engines?.node ?? "";
  const match = /(\d+)/.exec(range);
  if (match === null) {
    throw new Error(
      `package.json engines.node does not name a version: "${range}"`,
    );
  }
  return Number.parseInt(match[1], 10);
}

describe("the Node version", () => {
  const required = requiredNodeMajor();

  it("is a bare major version in .nvmrc", () => {
    expect(required).toBeGreaterThan(0);
  });

  it("is the same major in package.json's engines.node", () => {
    const pkg = readFileSync(PACKAGE_JSON, "utf8");
    expect(engineNodeMajor(pkg)).toBe(required);
  });

  it("is the same major in every ci.yml node-version line", () => {
    const workflow = readFileSync(WORKFLOW, "utf8");
    const majors = ciNodeMajors(workflow);
    // Guards against a renamed step turning the agreement check below into a
    // comparison against an empty list, which trivially passes.
    expect(majors.length).toBeGreaterThan(0);
    expect(new Set(majors)).toEqual(new Set([required]));
  });
});

describe("unsupportedNodeVersion", () => {
  it("names an older Node as the reason", () => {
    const reason = unsupportedNodeVersion("v18.19.1", 22);
    expect(reason).toMatch(/v18\.19\.1/);
    expect(reason).toMatch(/22/);
  });

  it("accepts the required major, and any newer one", () => {
    expect(unsupportedNodeVersion("v22.23.2", 22)).toBeNull();
    expect(unsupportedNodeVersion("v23.0.0", 22)).toBeNull();
  });
});
