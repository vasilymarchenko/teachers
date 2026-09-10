/**
 * Diff hygiene: three things that are cheap to check and expensive to notice in
 * review (T-029).
 *
 * It has no counterpart in `ci.yml` on purpose — all three are properties of a
 * *diff*, and CI checks out a commit rather than reviewing one.
 *
 * Pure over its inputs, so `scripts/gate/hygiene.test.ts` asserts against
 * strings rather than against whatever this repository happens to contain.
 */

import { readFileSync } from "node:fs";

import { git } from "./ledger";

/** The marker of the block `next dev` writes into the root `CLAUDE.md`. */
export const NEXT_DEV_BLOCK = "This block is written and re-added by `next dev`";

export interface HygieneInput {
  changedFiles: readonly string[];
  /** The contents of each changed file that still exists, by path. */
  contents: ReadonlyMap<string, string>;
  /** The working tree's `CLAUDE.md`, or `null` if there is none. */
  claudeMd: string | null;
  /** `CLAUDE.md` as committed at `HEAD`, or `null` if it cannot be read. */
  claudeMdAtHead: string | null;
}

/** One line per problem. An empty list is a pass. */
export function hygieneProblems(input: HygieneInput): string[] {
  const problems: string[] = [];

  for (const file of input.changedFiles) {
    if (!/\.test\.tsx?$/.test(file)) continue;
    const source = input.contents.get(file);
    if (source === undefined) continue;
    // Anchored at a statement position — start of a line, or after `;` or
    // `}` — so a quoted mention of the form in a test *about* this check is
    // not itself a finding. Textual, like `lib/db/postgresImage.test.ts`:
    // there is no parser here, and the anchor is what keeps it off the things
    // that merely look like one.
    if (/(?:^|[\s;}])(?:describe|it|test)\.only\s*\(/m.test(source)) {
      // A focused test is green locally and green in CI while running almost
      // none of the file.
      problems.push(`${file}: a focused .only test would silence the suite`);
    }
  }

  for (const file of input.changedFiles) {
    const name = file.split("/").at(-1) ?? file;
    // `.env.example` is committed and is the one that must be.
    if (name === ".env.example" || !name.startsWith(".env")) continue;
    problems.push(`${file}: an environment file must not be in the diff`);
  }

  const { claudeMd, claudeMdAtHead } = input;
  if (claudeMd !== null && !claudeMd.includes(NEXT_DEV_BLOCK)) {
    // Removing it from a diff only re-creates the uncommitted change.
    problems.push(
      "CLAUDE.md: the block `next dev` maintains was removed; it will come back",
    );
  } else if (
    claudeMd !== null &&
    claudeMdAtHead !== null &&
    !claudeMdAtHead.includes(NEXT_DEV_BLOCK)
  ) {
    // The block exists only as an uncommitted change: `next dev` wrote it back
    // and it is about to be handed over as a stray change. Committing it with
    // the work is what keeps the tree clean. This is deliberately not "is
    // CLAUDE.md dirty" — an ordinary in-progress edit to it is not a finding,
    // and the gate runs before the fix is committed.
    problems.push(
      "CLAUDE.md: the block `next dev` re-added is not committed — " +
        "commit it with the work rather than handing it over as a stray change",
    );
  }

  return problems;
}

/** Reads what the check needs out of the working tree. */
export function runHygiene(changedFiles: readonly string[]): string[] {
  const contents = new Map<string, string>();
  for (const file of changedFiles) {
    try {
      contents.set(file, readFileSync(file, "utf8"));
    } catch {
      // Deleted by the change, or never existed. Nothing to check in it.
    }
  }
  const read = (path: string): string | null => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  };
  return hygieneProblems({
    changedFiles,
    contents,
    claudeMd: read("CLAUDE.md"),
    claudeMdAtHead: git(["show", "HEAD:CLAUDE.md"]),
  });
}
