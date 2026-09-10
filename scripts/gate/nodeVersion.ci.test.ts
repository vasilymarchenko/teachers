import { randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { requiredNodeMajor, unsupportedNodeVersion } from "./nodeVersion";

/**
 * The Node major version is named four times, and they have to agree.
 *
 * `.nvmrc` is what `nvm use` reads, `package.json`'s `engines.node` is what
 * `npm install` warns about, `.github/workflows/ci.yml`'s two
 * `node-version: 22` lines are what the runner installs, and the
 * `Dockerfile`'s four `node:22-alpine` stages build the images the VPS runs.
 * A skew between them is the gap T-031 closes: four files a developer's
 * shell or a deploy can read and, before this, nothing that compared them.
 * Same shape as `lib/db/postgresImage.test.ts`, and
 * `scripts/gate/checks.ci.test.ts` for the `ci.yml` half.
 */

const PACKAGE_JSON = "package.json";
const WORKFLOW = ".github/workflows/ci.yml";
const DOCKERFILE = "Dockerfile";

function ciNodeMajors(source: string): number[] {
  return [...source.matchAll(/node-version:\s*["']?(\d+)["']?/g)].map(
    ([, major]) => Number.parseInt(major, 10),
  );
}

function dockerfileNodeMajors(source: string): number[] {
  return [...source.matchAll(/^FROM node:(\d+)-alpine/gm)].map(([, major]) =>
    Number.parseInt(major, 10),
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

  it("is the same major in every Dockerfile FROM node:… stage", () => {
    const dockerfile = readFileSync(DOCKERFILE, "utf8");
    const majors = dockerfileNodeMajors(dockerfile);
    // Same guard: a stage renamed off `node:<major>-alpine` must not turn
    // this into an empty, trivially-passing comparison.
    expect(majors.length).toBeGreaterThan(0);
    expect(new Set(majors)).toEqual(new Set([required]));
  });
});

describe("dockerfileNodeMajors", () => {
  it("reads every FROM node:<major>-alpine stage", () => {
    expect(
      dockerfileNodeMajors(
        "FROM node:22-alpine AS deps\n" +
          "RUN apk add --no-cache libc6-compat\n" +
          "FROM node:22-alpine AS runner\n",
      ),
    ).toEqual([22, 22]);
  });

  it("ignores a stage built from something else", () => {
    // Without this, a stage renamed off `node:` — a distroless or `alpine`
    // base for a later stage — would silently stop being compared, the same
    // way a renamed job emptied `checks.ci.test.ts`'s comparison.
    expect(dockerfileNodeMajors("FROM alpine:3.20 AS certs\n")).toEqual([]);
  });
});

describe("requiredNodeMajor", () => {
  it("throws, naming the path and the content, on a bare-major .nvmrc's opposite: an alias", () => {
    // A synthetic file, never the real .nvmrc — this must not depend on or
    // perturb the one the rest of this suite reads. A common nvm alias, not
    // a bare major, is exactly the shape a hand-edited .nvmrc could take.
    const tmp = join(tmpdir(), `nvmrc-bad-${randomUUID()}`);
    writeFileSync(tmp, "lts/*\n");
    try {
      expect(() => requiredNodeMajor(tmp)).toThrow(/lts\/\*/);
    } finally {
      rmSync(tmp);
    }
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

  it("reads the real .nvmrc when requiredMajor is not given", () => {
    // The path unsupportedNodeVersion() takes when called with no arguments
    // at all — its own default parameter reads the real .nvmrc, guarded by
    // the try/catch around requiredNodeMajor() that the test above proves
    // throws on a bad file. With this repository's own well-formed .nvmrc,
    // that path succeeds.
    expect(unsupportedNodeVersion(`v${requiredNodeMajor()}.0.0`)).toBeNull();
  });
});
