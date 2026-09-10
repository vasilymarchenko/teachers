/**
 * The Node version a developer's shell needs before the gate can tell them
 * anything else about a change.
 *
 * `.nvmrc`, `package.json`'s `engines.node`, both `node-version: 22` lines in
 * `.github/workflows/ci.yml`, and the `Dockerfile`'s four `node:22-alpine`
 * stages — the images the VPS runs — are held in step by
 * `nodeVersion.ci.test.ts`. `CLAUDE.md` and `README.md` point at `.nvmrc`
 * instead of restating the number themselves.
 *
 * An older Node fails `npm test` and `npm run build` deep inside rolldown,
 * with `SyntaxError: ... does not provide an export named 'styleText'`, and
 * neither check says why (T-031). `scripts/gate/index.ts`'s `run()` calls
 * `unsupportedNodeVersion()` before selecting a single check.
 */

import { readFileSync } from "node:fs";

export const NVMRC_PATH = ".nvmrc";

/** The major version `.nvmrc` names — the same number `nvm use` reads. */
export function requiredNodeMajor(path: string = NVMRC_PATH): number {
  const raw = readFileSync(path, "utf8").trim();
  const major = Number.parseInt(raw, 10);
  if (!Number.isFinite(major)) {
    throw new Error(`${path} does not hold a version number: "${raw}"`);
  }
  return major;
}

/**
 * Why this Node cannot run the gate, or `null` when it can.
 *
 * "Older than", not "not exactly this major": `package.json`'s `engines.node`
 * is a `>=` range, not an exact one, and a newer major is not the failure
 * this exists to catch.
 *
 * `requiredMajor` defaults to reading `.nvmrc`, and that read is guarded: a
 * missing or unparseable `.nvmrc` must become a named reason, like every other
 * outcome `run()` records, not an uncaught throw that skips `finish()`
 * entirely and leaves `.gate/last-run.json` exactly as stale as the bare
 * early return this file exists to replace.
 */
export function unsupportedNodeVersion(
  actual: string = process.version,
  requiredMajor?: number,
): string | null {
  let required = requiredMajor;
  if (required === undefined) {
    try {
      required = requiredNodeMajor();
    } catch (error) {
      return `cannot read the required Node version from .nvmrc: ${(error as Error).message}`;
    }
  }

  const match = /^v(\d+)/.exec(actual);
  const actualMajor = match ? Number.parseInt(match[1], 10) : NaN;
  if (!Number.isFinite(actualMajor) || actualMajor < required) {
    return (
      `Node ${actual} is older than the Node ${required}+ this project ` +
      `requires (.nvmrc) — nvm use, or install Node ${required}+`
    );
  }
  return null;
}
