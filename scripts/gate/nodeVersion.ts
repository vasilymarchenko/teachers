/**
 * The Node version a developer's shell needs before the gate can tell them
 * anything else about a change.
 *
 * `.nvmrc`, `package.json`'s `engines.node` and both `node-version: 22` lines
 * in `.github/workflows/ci.yml` are held in step by `nodeVersion.ci.test.ts` —
 * `CLAUDE.md`'s "Node.js 22+" points at `.nvmrc` instead of restating the
 * number a fourth time.
 *
 * An older Node fails `npm test` and `npm run build` deep inside rolldown,
 * with `SyntaxError: ... does not provide an export named 'styleText'`, and
 * neither check says why (T-031). This runs before any check does.
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
 * "Older than", not "not exactly this major": `CLAUDE.md` has said "Node.js
 * 22+" since before this file existed, and a newer major is not the failure
 * this exists to catch.
 */
export function unsupportedNodeVersion(
  actual: string = process.version,
  requiredMajor: number = requiredNodeMajor(),
): string | null {
  const match = /^v(\d+)/.exec(actual);
  const actualMajor = match ? Number.parseInt(match[1], 10) : NaN;
  if (!Number.isFinite(actualMajor) || actualMajor < requiredMajor) {
    return (
      `Node ${actual} is older than the Node ${requiredMajor}+ this project ` +
      `requires (.nvmrc) — nvm use, or install Node ${requiredMajor}+`
    );
  }
  return null;
}
