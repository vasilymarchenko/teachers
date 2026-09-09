/**
 * Diff hygiene — the half of it a script can decide.
 *
 * These are the four ways a diff arrives carrying something nobody meant to
 * hand over. None of them is a CI check: CI reads a commit, and every one of
 * these is about the *change* rather than the tree it produced.
 *
 * The fifth rule — that every changed file appears in the approved plan's file
 * list, or is explained in the report — is not here, and cannot be: there is no
 * machine-readable plan to compare against. It stays an obligation on
 * `/teachers-ticket` phase 7, and this check does not pretend to cover it.
 */

export type HygieneInput = {
  /** Paths in the diff, repository-relative, forward slashes. */
  readonly changedPaths: readonly string[];
  /** The unified diff itself — only added lines are read. */
  readonly diff: string;
  /** `git status --porcelain`, for the uncommitted half. */
  readonly status: string;
};

/** Lines a unified diff adds, without the leading `+`, tagged with their file. */
export function addedLines(diff: string): { file: string; line: string }[] {
  const added: { file: string; line: string }[] = [];
  let file = "";
  for (const raw of diff.split("\n")) {
    const header = /^\+\+\+ (?:b\/)?(.+)$/.exec(raw);
    if (header) {
      file = header[1] === "/dev/null" ? "" : header[1];
      continue;
    }
    // `+++` is the header, matched above; a `+` that is not `++` is content.
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      added.push({ file, line: raw.slice(1) });
    }
  }
  return added;
}

const TEST_FILE = /\.test\.tsx?$/;

/**
 * `it.only(`, `describe.only(` — and the `.skip` / `.todo` pair.
 *
 * Anchored to the start of the line, because that is where a focused test is
 * actually written. An unanchored pattern also matches the call quoted inside a
 * string, which is how this check first reported four defects in its own
 * fixtures: `hygiene.test.ts` passes literal diff text like `"+  it.only(…)"`
 * to prove the check fires on it. A check phrased more widely than the rule it
 * comes from is how a reviewer starts producing confident nonsense.
 */
const RUNNER = "(?:describe|it|test|suite|bench)";
const LEAD = "^\\s*(?:await\\s+|return\\s+)?";
const FOCUSED = new RegExp(`${LEAD}${RUNNER}\\.only\\s*\\(`);
const DISABLED = new RegExp(`${LEAD}${RUNNER}\\.(?:skip|todo)\\s*\\(`);

/**
 * A `.env` in the diff. `.env.example` is the committed template and is fine;
 * everything else under that name is a secret or a machine-local override.
 */
const ENV_FILE = /(?:^|\/)\.env(?!\.example$)/;

export function hygieneProblems(input: HygieneInput): string[] {
  const problems: string[] = [];
  const added = addedLines(input.diff);

  for (const { file, line } of added) {
    if (!TEST_FILE.test(file)) continue;
    if (FOCUSED.test(line)) {
      problems.push(`${file}: a focused test (\`.only\`) — the suite would run only that`);
    }
    if (DISABLED.test(line)) {
      problems.push(`${file}: a newly added \`.skip\`/\`.todo\` — a test that is handed over switched off`);
    }
  }

  for (const path of input.changedPaths) {
    if (ENV_FILE.test(path)) {
      problems.push(`${path}: an env file in the diff — .env.example is the only one that is committed`);
    }
  }

  // `next dev` rewrites the Next.js block into CLAUDE.md on every start. Left
  // uncommitted it is a change nobody chose, and removing it from a diff only
  // re-creates it; committing it with the work keeps the tree clean.
  // `XY PATH`, the two porcelain status columns; `  ` means unchanged, and
  // nothing unchanged is listed, so any entry for the file is a stray change.
  if (/^.. CLAUDE\.md$/m.test(input.status)) {
    problems.push(
      "CLAUDE.md: modified but not committed — commit the block `next dev` re-adds with the work, or restore the file",
    );
  }

  return problems;
}
