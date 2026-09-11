/**
 * The routing, stated once: which checks a change needs, and what each one
 * needs from the machine it runs on.
 *
 * This list and `.github/workflows/ci.yml` are two definitions of one thing.
 * Neither generates the other; `scripts/gate/checks.ci.test.ts` reads both and
 * fails when they disagree — the `lib/db/postgresImage.test.ts` shape, and the
 * reasoning is `docs/architecture/decisions/ADR-012-one-check-definition.md`.
 */

import { spawnSync } from "node:child_process";

/** What a check needs from the machine before it can say anything at all. */
export type Requirement = "docker" | "database" | "psql" | "ci-only";

/**
 * What kind of change a diff is (T-037).
 *
 * The second dimension of the routing, beside the paths. `paths` asks which
 * *extra* checks a change pulls in; this asks whether a check that every change
 * pulls in is worth running on this one at all. `build` and `test` read
 * `app/**`, `lib/**` and `components/**` and nothing else, so a diff of prose
 * pays several minutes for an answer that cannot differ from the last one.
 *
 * `documentation` is the narrow side and has to be: a file is prose only when
 * it is a `.md` or sits under `docs/`, and anything else — a hook script, a
 * JSON setting, a workflow — is `code`, because the suite reads several such
 * files. A diff carrying one code file is a code change however much prose is
 * beside it; the classification is by what the diff contains, never by which
 * part of it the reader means to look at.
 */
export type ChangeKind = "code" | "documentation";

/** A file with no code in it. Everything else makes the change a code change. */
const PROSE_PATHS = [/\.md$/, /^docs\//] as const;

/**
 * The kind of change, from the paths alone.
 *
 * An empty list is `code`. There is nothing to classify, and the conservative
 * answer is the one that checks more: a gate that reported "documentation" for
 * a diff it could not resolve would run less than CI on a change nobody had
 * looked at.
 */
export function changeKind(changedFiles: readonly string[]): ChangeKind {
  if (changedFiles.length === 0) return "code";
  return changedFiles.every((file) =>
    PROSE_PATHS.some((pattern) => pattern.test(file)),
  )
    ? "documentation"
    : "code";
}

export interface Check {
  /** The name that appears in the table, the ledger and the PR body. */
  name: string;
  /**
   * argv, run without a shell. A function when an argument has to be resolved
   * at run time. `null` means there is no local command — see `inProcess`.
   */
  argv: readonly string[] | (() => readonly string[]) | null;
  /** Dispatched in-process by name, rather than by `argv` being absent. */
  inProcess?: "hygiene";
  /**
   * The paths that pull this check in. `null` means every change needs it.
   * Matched against repository-relative paths with `/` separators.
   */
  paths: readonly RegExp[] | null;
  /**
   * The kinds of change that need this check. Absent means every kind.
   *
   * A check this routes away is reported `skipped` with the reason rather than
   * dropped from the table, for the same reason an unmet requirement is: the
   * gate never quietly checks less than `ci.yml`, whose `checks` job runs on
   * every push regardless (`ADR-016`).
   */
  kinds?: readonly ChangeKind[];
  requires?: readonly Requirement[];
  /** The `ci.yml` job this check corresponds to, if any. */
  ciJob?: "checks" | "integration" | "images";
  /** The npm script `ci.yml` runs for it — the bidirectional half of parity. */
  ciScript?: string;
  /**
   * A substring that must appear in that job, for a step that is not an npm
   * script. Forward-only: `ci.yml`'s non-npm steps are not enumerable the way
   * its `npm run` lines are.
   */
  ciAnchor?: string;
  /** Shown next to a `skipped` row, so a skip is never read as a pass. */
  skipReason?: string;
}

/**
 * A change under any of these has to answer to a real database.
 *
 * `scripts/verify-schema.sql` and `drizzle.config.ts` are here because
 * `ci.yml`'s `integration` job runs against both on every push: a change to the
 * assertion file alone, or to where the migrator points, would otherwise run no
 * database check locally and the full one in CI — the gap this gate exists to
 * close.
 */
const DATABASE_PATHS = [
  /^lib\/db\//,
  /^drizzle\//,
  /^drizzle\.config\.ts$/,
  /^scripts\/verify-schema\.sql$/,
] as const;

/** A change to either of these rebuilds what the VPS pulls. */
const IMAGE_PATHS = [/^Dockerfile$/, /^docker-compose[\w.-]*\.ya?ml$/] as const;

export const CHECKS: readonly Check[] = [
  {
    name: "lint",
    argv: ["npm", "run", "lint"],
    paths: null,
    ciJob: "checks",
    ciScript: "lint",
  },
  {
    name: "typecheck",
    argv: ["npm", "run", "typecheck"],
    paths: null,
    ciJob: "checks",
    ciScript: "typecheck",
  },
  {
    // Routed by kind as well as by path (T-037): the unit suite is mostly
    // `lib/domain` over code the prose does not touch, so a diff of documents
    // rarely changes its answer — but the convention tests read `.md` files
    // (`skills.test.ts` reads both `SKILL.md`s), so sometimes it does, and
    // then the failure lands in CI rather than here. `ci.yml` runs the suite
    // on the pushed commit either way; `ADR-016` § Consequences is where that
    // cost is declared rather than hidden.
    name: "test",
    argv: ["npm", "test"],
    paths: null,
    kinds: ["code"],
    ciJob: "checks",
    ciScript: "test",
  },
  {
    // In `ci.yml` and in neither skill before T-029, which is how a pull
    // request could be verified locally and be red in CI. Routed by kind for
    // the same reason as `test`, and more so: it is the slowest check here and
    // `next build` compiles no document at all.
    name: "build",
    argv: ["npm", "run", "build"],
    paths: null,
    kinds: ["code"],
    ciJob: "checks",
    ciScript: "build",
  },
  {
    // No CI counterpart: the three things it looks for are properties of a
    // diff, and CI checks out a commit rather than reviewing one.
    name: "hygiene",
    argv: null,
    inProcess: "hygiene",
    paths: null,
  },
  {
    name: "db:migrate",
    argv: ["npm", "run", "db:migrate"],
    paths: DATABASE_PATHS,
    requires: ["database"],
    ciJob: "integration",
    ciScript: "db:migrate",
  },
  {
    // Run the way CI runs it — `psql` against the file — rather than through a
    // driver, so one assertion file keeps one execution path.
    name: "verify-schema",
    // `psql "$DATABASE_URL" …`, exactly as `ci.yml` invokes it. libpq does not
    // read `DATABASE_URL` itself, so without this argument the check would
    // connect to the local socket as the OS user and assert against whatever
    // database it found there — passing or failing for reasons that have
    // nothing to do with the change.
    argv: () => [
      "psql",
      process.env.DATABASE_URL ?? "",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "scripts/verify-schema.sql",
    ],
    paths: DATABASE_PATHS,
    requires: ["database", "psql"],
    ciJob: "integration",
    ciAnchor: "scripts/verify-schema.sql",
  },
  {
    name: "test:integration",
    argv: ["npm", "run", "test:integration"],
    paths: DATABASE_PATHS,
    requires: ["database"],
    ciJob: "integration",
    ciScript: "test:integration",
  },
  {
    name: "docker:runner",
    argv: ["docker", "build", "--target", "runner", "."],
    paths: IMAGE_PATHS,
    requires: ["docker"],
    ciJob: "images",
    ciAnchor: "target: runner",
  },
  {
    name: "docker:migrator",
    argv: ["docker", "build", "--target", "migrator", "."],
    paths: IMAGE_PATHS,
    requires: ["docker"],
    ciJob: "images",
    ciAnchor: "target: migrator",
  },
  {
    // Routed so that a change to the images is never reported as fully checked
    // here, and never run: CI does it as a five-step orchestration — a
    // throwaway Postgres, the migrator image against it, `verify-schema.sql`
    // again, then cleanup — and transcribing that sequence into a second file
    // is the local reimplementation T-029 rules out. T-030 is the fix that
    // needs no second copy: one script, called by CI and by the gate.
    name: "migrator-smoke",
    argv: null,
    paths: IMAGE_PATHS,
    requires: ["ci-only"],
    ciJob: "images",
    ciAnchor: "teachers-migrator:ci",
    skipReason:
      "runs in CI only — ci.yml `images`; T-030 unifies the two into one script",
  },
] as const;

/**
 * The checks a change needs, in declaration order.
 *
 * Order is `CHECKS` order rather than the order paths arrived in, so two runs
 * over the same change print the same table.
 */
export function selectChecks(changedFiles: readonly string[]): Check[] {
  return CHECKS.filter((check) => {
    const { paths } = check;
    if (paths === null) return true;
    return changedFiles.some((file) =>
      paths.some((pattern) => pattern.test(file)),
    );
  });
}

/**
 * Why this kind of change does not need this check, or `null` when it does.
 *
 * The reason names `ci.yml`, because that is what makes the routing safe: the
 * `checks` job runs on every push with no path filter on its trigger, so a
 * check routed away here is still run against the commit before anything can be
 * merged. A reader of the table — or of the pull request body, which carries
 * the same rows — is told which of the two ran it (`ADR-016`).
 */
export function routedAwayByKind(
  check: Check,
  kind: ChangeKind,
): string | null {
  if (check.kinds === undefined || check.kinds.includes(kind)) return null;
  const job =
    check.ciJob === undefined ? "ci.yml" : `ci.yml \`${check.ciJob}\``;
  return `not needed for a ${kind} change — ${job} runs it on every push`;
}

/**
 * The first requirement this machine does not meet, with the reason that goes
 * in the table next to `skipped`, or `null` when the check can run.
 *
 * Probed on every invocation and never cached. An environment fix — starting
 * Postgres, exporting `DATABASE_URL` — changes no file, so a gate that
 * remembered this answer would keep refusing a check the developer had just
 * repaired, and the only escape would be an edit that means nothing (T-029).
 */
export function unmetRequirement(
  check: Check,
  probe: EnvironmentProbe = probeEnvironment,
): string | null {
  for (const requirement of check.requires ?? []) {
    const reason = probe(requirement);
    if (reason !== null) return reason;
  }
  return null;
}

export type EnvironmentProbe = (requirement: Requirement) => string | null;

function probeEnvironment(requirement: Requirement): string | null {
  switch (requirement) {
    case "database":
      return process.env.DATABASE_URL
        ? null
        : "DATABASE_URL is not set — `docker compose up -d`, then `npm run db:migrate`";
    case "psql":
      return commandExists("psql") ? null : "psql is not on PATH";
    case "docker":
      return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0
        ? null
        : "no Docker daemon here";
    case "ci-only":
      return "runs in CI only";
  }
}

function commandExists(command: string): boolean {
  return (
    spawnSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" })
      .status === 0
  );
}
