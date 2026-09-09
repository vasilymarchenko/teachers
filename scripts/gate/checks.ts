/**
 * The check table: the single place that says what "checked" means locally.
 *
 * `.github/workflows/ci.yml` is the authoritative gate (ADR-007). This table is
 * the same set of checks, arranged for one machine instead of four jobs, so a
 * developer or an agent can get CI's answer before pushing. Nothing here
 * duplicates a *rule* — every entry names the CI step it stands for in `ci`,
 * and `checks.test.ts` fails when the two sets drift apart.
 *
 * ADR-011 records why the two definitions are held in step by a test rather
 * than by making one call the other.
 */

/** Where a check's work happens. `run.ts` owns the process, this owns the choice. */
export type CheckKind =
  | { readonly type: "npm"; readonly script: string }
  | { readonly type: "internal"; readonly id: InternalCheckId };

/** Checks implemented in TypeScript rather than spawned as an npm script. */
export type InternalCheckId =
  | "verify-schema"
  | "image:runner"
  | "image:migrator"
  | "migrator-smoke"
  | "diff-hygiene";

/** What a check needs from the machine before it can mean anything. */
export type Requirement = "docker" | "database";

export type Check = {
  readonly name: string;
  /**
   * The step in `ci.yml` this check stands for, or `null` for a check the gate
   * has and CI does not. A string here must occur literally in `ci.yml`.
   */
  readonly ci: string | null;
  /** `true` when the check runs on every diff; otherwise the paths that select it. */
  readonly when: true | readonly RegExp[];
  readonly requires?: Requirement;
  readonly kind: CheckKind;
  /** One line, printed in the report next to a skip. */
  readonly what: string;
};

/**
 * The paths that select the database half of the gate.
 *
 * `lib/db/**` and `drizzle/**` are the ticket's routing. `scripts/verify-schema.sql`
 * is added on top: it is the assertion those two are checked *by*, and a change
 * to it that nobody runs is the one edit that can weaken the check silently.
 * A routing rule may be wider than CI's — never narrower.
 */
const DATABASE_PATHS = [
  /^lib\/db\//,
  /^drizzle\//,
  /^scripts\/verify-schema\.sql$/,
] as const;

/** The paths that select the image half. Both compose files describe the same stack. */
const IMAGE_PATHS = [/^Dockerfile$/, /^docker-compose[^/]*\.ya?ml$/] as const;

export const CHECKS: readonly Check[] = [
  {
    name: "lint",
    ci: "npm run lint",
    when: true,
    kind: { type: "npm", script: "lint" },
    what: "ESLint over the whole tree",
  },
  {
    name: "typecheck",
    ci: "npm run typecheck",
    when: true,
    kind: { type: "npm", script: "typecheck" },
    what: "tsc --noEmit",
  },
  {
    name: "test",
    ci: "npm test",
    when: true,
    kind: { type: "npm", script: "test" },
    what: "the unit suite",
  },
  {
    name: "build",
    ci: "npm run build",
    when: true,
    kind: { type: "npm", script: "build" },
    what: "next build",
  },
  {
    // No CI counterpart, and that is the point: CI checks a commit, this checks
    // the change a human is about to hand over. See `hygiene.ts`.
    name: "diff-hygiene",
    ci: null,
    when: true,
    kind: { type: "internal", id: "diff-hygiene" },
    what: "no .only, no new .skip, no .env, no stray CLAUDE.md block",
  },
  {
    name: "db:migrate",
    ci: "npm run db:migrate",
    when: DATABASE_PATHS,
    requires: "database",
    kind: { type: "npm", script: "db:migrate" },
    what: "drizzle-kit migrate against DATABASE_URL",
  },
  {
    // Between the migration and the suite, for the reason `ci.yml` gives: the
    // suite cannot tell a database that rejects overlaps from one with no
    // constraint to reject them with.
    name: "verify-schema",
    ci: "scripts/verify-schema.sql",
    when: DATABASE_PATHS,
    requires: "database",
    kind: { type: "internal", id: "verify-schema" },
    what: "scripts/verify-schema.sql against DATABASE_URL",
  },
  {
    name: "test:integration",
    ci: "npm run test:integration",
    when: DATABASE_PATHS,
    requires: "database",
    kind: { type: "npm", script: "test:integration" },
    what: "the suite that needs a migrated Postgres",
  },
  {
    name: "image:runner",
    ci: "target: runner",
    when: IMAGE_PATHS,
    requires: "docker",
    kind: { type: "internal", id: "image:runner" },
    what: "docker build --target runner",
  },
  {
    name: "image:migrator",
    ci: "target: migrator",
    when: IMAGE_PATHS,
    requires: "docker",
    kind: { type: "internal", id: "image:migrator" },
    what: "docker build --target migrator",
  },
  {
    // ADR-003 publishes the migrator image so the VPS never builds it; this is
    // the only thing that runs it before a deploy does.
    name: "migrator-smoke",
    ci: "teachers-migrator:ci",
    when: IMAGE_PATHS,
    requires: "docker",
    kind: { type: "internal", id: "migrator-smoke" },
    what: "the migrator image migrates a throwaway database, then verify-schema",
  },
] as const;

/** The order checks run and are reported in — cheap and always-on first. */
export function selectChecks(changedPaths: readonly string[]): readonly Check[] {
  return CHECKS.filter(
    (check) =>
      check.when === true ||
      check.when.some((pattern) =>
        changedPaths.some((path) => pattern.test(path)),
      ),
  );
}

export function checkByName(name: string): Check | undefined {
  return CHECKS.find((check) => check.name === name);
}
