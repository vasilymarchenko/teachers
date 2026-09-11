import { describe, expect, it } from "vitest";

import {
  CHECKS,
  changeKind,
  routedAwayByKind,
  selectChecks,
  unmetRequirement,
} from "./checks";

/**
 * The routing, against the sentence the root `CLAUDE.md` states it in:
 *
 *   "always `lint`, `typecheck` and `hygiene`, plus `test` and `build` for a
 *    change that contains code; the database checks for `lib/db/**`,
 *    `drizzle/**`, `drizzle.config.ts` or `scripts/verify-schema.sql`, and the
 *    image builds for the `Dockerfile` or a Compose file."
 *
 * That sentence and `ci.yml` are the routing's only two authorities;
 * `checks.ci.test.ts` holds the second one, and is also where the one place
 * the two deliberately differ is declared — `test` and `build` are routed by
 * kind here and run unconditionally there (T-037, `ADR-016`).
 */

const names = (files: string[]) =>
  selectChecks(files).map((check) => check.name);

/** `hygiene` is the gate's own, with no counterpart in `ci.yml`. */
const ALWAYS = ["lint", "typecheck", "test", "build", "hygiene"];
const DATABASE = ["db:migrate", "verify-schema", "test:integration"];
const IMAGES = ["docker:runner", "docker:migrator", "migrator-smoke"];

describe("selectChecks", () => {
  it("runs the always-on checks for a change that touches nothing else", () => {
    expect(names([])).toEqual(ALWAYS);
    expect(names(["app/page.tsx", "components/nav.tsx"])).toEqual(ALWAYS);
  });

  it("adds the database checks for lib/db and for drizzle", () => {
    expect(names(["lib/db/schema/event.ts"])).toEqual([...ALWAYS, ...DATABASE]);
    expect(names(["drizzle/0007_add_event.sql"])).toEqual([
      ...ALWAYS,
      ...DATABASE,
    ]);
  });

  it("adds them for the two other files ci.yml's integration job runs against", () => {
    // A change to the assertion file alone, or to where the migrator points,
    // would otherwise run no database check locally and the full one in CI.
    expect(names(["scripts/verify-schema.sql"])).toEqual([
      ...ALWAYS,
      ...DATABASE,
    ]);
    expect(names(["drizzle.config.ts"])).toEqual([...ALWAYS, ...DATABASE]);
  });

  it("does not treat every lib/** file as a database change", () => {
    // Guards a glob written one segment too wide: the domain is DB-free by
    // construction (`architect-overview.md` §2), and routing it to a suite that
    // needs Postgres would make every domain change unrunnable without one.
    expect(names(["lib/domain/schedule/expand.ts"])).toEqual(ALWAYS);
    expect(names(["lib/time/today.ts"])).toEqual(ALWAYS);
  });

  it("adds the image checks for the Dockerfile and either compose file", () => {
    expect(names(["Dockerfile"])).toEqual([...ALWAYS, ...IMAGES]);
    expect(names(["docker-compose.yml"])).toEqual([...ALWAYS, ...IMAGES]);
    expect(names(["docker-compose.prod.yml"])).toEqual([...ALWAYS, ...IMAGES]);
  });

  it("selects each check once, in one order, however the paths arrive", () => {
    const files = ["drizzle/x.sql", "Dockerfile", "lib/db/client.ts"];
    expect(names(files)).toEqual([...ALWAYS, ...DATABASE, ...IMAGES]);
    expect(names([...files].reverse())).toEqual(names(files));
  });
});

describe("what a check needs from the machine", () => {
  const nothingAvailable = () => "unavailable here";

  it("reports the reason rather than dropping the check", () => {
    // A skip is never a pass, so it stays in the list and carries why.
    const integration = CHECKS.find((c) => c.name === "test:integration")!;
    expect(unmetRequirement(integration, nothingAvailable)).toBe(
      "unavailable here",
    );
  });

  it("says nothing about a check with no requirements", () => {
    const lint = CHECKS.find((check) => check.name === "lint")!;
    expect(unmetRequirement(lint, nothingAvailable)).toBeNull();
  });

  it("lets a met requirement through", () => {
    const build = CHECKS.find((check) => check.name === "docker:runner")!;
    expect(unmetRequirement(build, () => null)).toBeNull();
  });

  it("gives verify-schema the connection string ci.yml gives it", () => {
    // libpq does not read DATABASE_URL, so without this the check would connect
    // to the local socket as the OS user and assert against whatever database
    // it found — passing or failing for reasons unrelated to the change.
    const check = CHECKS.find((c) => c.name === "verify-schema")!;
    const argv = typeof check.argv === "function" ? check.argv() : check.argv;
    expect(argv?.[0]).toBe("psql");
    expect(argv).toContain("scripts/verify-schema.sql");
    expect(argv).toHaveLength(6);
  });

  it("runs no check in-process except by name", () => {
    // `migrator-smoke` also carries no argv. Dispatching on that absence alone
    // is how it would come back green the day its requirement is relaxed.
    const inProcess = CHECKS.filter((check) => check.inProcess !== undefined);
    expect(inProcess.map((check) => check.name)).toEqual(["hygiene"]);
    expect(
      CHECKS.find((c) => c.name === "migrator-smoke")?.inProcess,
    ).toBeUndefined();
  });

  it("keeps the migrator smoke test out of this machine and says why", () => {
    // T-029 routes it so a change to the images is never reported as fully
    // checked here, and does not transcribe CI's five-step orchestration into
    // a second file. T-030 is the unification.
    const smoke = CHECKS.find((check) => check.name === "migrator-smoke")!;
    expect(smoke.requires).toContain("ci-only");
    expect(smoke.skipReason).toMatch(/CI only/);
  });
});

describe("changeKind", () => {
  it("calls a diff of prose a documentation change", () => {
    expect(changeKind(["docs/backlog/T-037-cost-a-change.md"])).toBe(
      "documentation",
    );
    expect(changeKind(["CLAUDE.md", ".claude/skills/x/SKILL.md"])).toBe(
      "documentation",
    );
  });

  it("calls a diff with any code in it a code change", () => {
    expect(changeKind(["lib/time/today.ts"])).toBe("code");
    expect(changeKind([".claude/hooks/session-start-fetch.sh"])).toBe("code");
    expect(changeKind([".github/workflows/ci.yml"])).toBe("code");
  });

  it("classifies a mixed diff by what it contains, not by what is read", () => {
    // The whole rule: one code file makes it a code change however much prose
    // is beside it, and the reviewer's intention does not enter into it.
    expect(changeKind(["docs/x.md", "CLAUDE.md", "lib/time/today.ts"])).toBe(
      "code",
    );
  });

  it("answers `code` for a diff it cannot resolve", () => {
    // The conservative side. A gate that said "documentation" here would run
    // less than CI on a change nobody had looked at.
    expect(changeKind([])).toBe("code");
  });

  it("does not mistake a file merely named like a document", () => {
    expect(changeKind(["lib/domain/markdown.ts"])).toBe("code");
    expect(changeKind(["scripts/docs/build.ts"])).toBe("code");
  });
});

describe("routedAwayByKind", () => {
  const check = (name: string) => CHECKS.find((c) => c.name === name)!;

  it("routes test and build away from a documentation change", () => {
    for (const name of ["test", "build"]) {
      const reason = routedAwayByKind(check(name), "documentation");
      // The reason names `ci.yml`, which is what makes the routing safe: the
      // check still runs against the pushed commit (ADR-016).
      expect(reason).toMatch(/ci\.yml `checks`/);
    }
  });

  it("runs them for a code change", () => {
    expect(routedAwayByKind(check("test"), "code")).toBeNull();
    expect(routedAwayByKind(check("build"), "code")).toBeNull();
  });

  it("routes nothing else away from anything", () => {
    // `hygiene` above all: its three checks are properties of a diff, not of
    // the source tree, so every kind of change needs it.
    const restricted = CHECKS.filter((c) => c.kinds !== undefined);
    expect(restricted.map((c) => c.name)).toEqual(["test", "build"]);
    expect(routedAwayByKind(check("hygiene"), "documentation")).toBeNull();
    expect(routedAwayByKind(check("lint"), "documentation")).toBeNull();
    expect(routedAwayByKind(check("typecheck"), "documentation")).toBeNull();
  });
});
