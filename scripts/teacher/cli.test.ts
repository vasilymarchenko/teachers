import { describe, expect, it } from "vitest";
import type { Teacher, TeacherResult } from "@/lib/auth/teachers";
import { EXIT_OK, EXIT_REFUSED, EXIT_USAGE, run, type Io, type Operations } from "./cli";

/**
 * The console command with the terminal and the operations replaced — T-039.
 *
 * What is pinned here is what the command itself owns: where a password may
 * come from, what is refused before any operation is called, and the exit code
 * each outcome produces. What the operations do to the database is
 * `lib/auth/teachers.integration.test.ts`.
 */

const TEACHER: Teacher = {
  email: "olena@example.test",
  name: "Олена Шевченко",
  active: true,
  createdAt: new Date("2026-09-01T08:00:00.000Z"),
};

function harness(options: { isTerminal?: boolean; typed?: string[]; result?: TeacherResult } = {}) {
  const typed = [...(options.typed ?? [])];
  const result = options.result ?? { ok: true, teacher: TEACHER };
  const calls: unknown[][] = [];
  const out: string[] = [];
  const err: string[] = [];
  const prompts: string[] = [];

  const io: Io = {
    isTerminal: options.isTerminal ?? true,
    readHidden: async (prompt) => {
      prompts.push(prompt);
      const next = typed.shift();
      if (next === undefined) throw new Error("the test typed nothing for this prompt");
      return next;
    },
    generatePassword: () => "generated-password-1234",
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  };

  const operations: Operations = {
    createTeacher: async (input) => (calls.push(["create", input]), result),
    setTeacherPassword: async (email, password) => (calls.push(["password", email, password]), result),
    deactivateTeacher: async (email) => (calls.push(["deactivate", email]), result),
    activateTeacher: async (email) => (calls.push(["activate", email]), result),
    listTeachers: async () => (calls.push(["list"]), [TEACHER, { ...TEACHER, email: "ivan@example.test", active: false }]),
  };

  return { io, operations, calls, out, err, prompts };
}

describe("where a password comes from", () => {
  it("is typed twice at a hidden prompt and passed on", async () => {
    const h = harness({ typed: ["typed-password", "typed-password"] });
    const code = await run(["create", TEACHER.email, "--name", TEACHER.name], h.io, h.operations);

    expect(code).toBe(EXIT_OK);
    expect(h.prompts).toHaveLength(2);
    expect(h.calls).toEqual([
      ["create", { email: TEACHER.email, name: TEACHER.name, password: "typed-password" }],
    ]);
    // A typed password is never said back.
    expect(h.out.join("\n")).not.toContain("typed-password");
  });

  it("is refused when the two entries differ, and nothing is called", async () => {
    const h = harness({ typed: ["typed-password", "typed-passwerd"] });
    const code = await run(["password", TEACHER.email], h.io, h.operations);

    expect(code).toBe(EXIT_REFUSED);
    expect(h.calls).toEqual([]);
  });

  it("is generated and printed once with --generate, with no prompt", async () => {
    const h = harness({ isTerminal: false });
    const code = await run(["password", TEACHER.email, "--generate"], h.io, h.operations);

    expect(code).toBe(EXIT_OK);
    expect(h.prompts).toEqual([]);
    expect(h.calls).toEqual([["password", TEACHER.email, "generated-password-1234"]]);
    expect(h.out.filter((line) => line.includes("generated-password-1234"))).toHaveLength(1);
  });

  it.each(["create", "password"])(
    "refuses %s with no terminal attached rather than read a password it cannot hide",
    async (command) => {
      const h = harness({ isTerminal: false });
      const code = await run([command, TEACHER.email], h.io, h.operations);

      expect(code).toBe(EXIT_REFUSED);
      expect(h.prompts).toEqual([]);
      expect(h.calls).toEqual([]);
    },
  );

  it.each([
    ["create", TEACHER.email, "a-password-as-an-argument"],
    ["password", TEACHER.email, "a-password-as-an-argument"],
    ["create", TEACHER.email, "--password", "a-password-as-an-argument"],
    ["password", TEACHER.email, "--password=a-password-as-an-argument"],
  ])("never reads one from an argument: %s %s %s", async (...argv) => {
    const h = harness({ typed: ["typed-password", "typed-password"] });
    const code = await run(argv, h.io, h.operations);

    expect(code).toBe(EXIT_USAGE);
    expect(h.calls).toEqual([]);
  });

  it("never reads one from the environment", async () => {
    const names = ["TEACHER_PASSWORD", "PASSWORD", "SEED_USER_PASSWORD"];
    const before = names.map((name) => process.env[name]);
    for (const name of names) process.env[name] = "a-password-from-the-environment";
    try {
      const h = harness({ isTerminal: false });
      const code = await run(["create", TEACHER.email], h.io, h.operations);

      expect(code).toBe(EXIT_REFUSED);
      expect(h.calls).toEqual([]);
    } finally {
      names.forEach((name, i) => {
        if (before[i] === undefined) delete process.env[name];
        else process.env[name] = before[i];
      });
    }
  });
});

describe("the name of a new teacher", () => {
  it("falls back to the address", async () => {
    const h = harness();
    await run(["create", TEACHER.email, "--generate"], h.io, h.operations);

    expect(h.calls).toEqual([
      ["create", { email: TEACHER.email, name: TEACHER.email, password: "generated-password-1234" }],
    ]);
  });
});

describe("a refused operation", () => {
  it.each([
    [["create", "--generate"], { ok: false, reason: "email-taken" }],
    [["create", "--generate"], { ok: false, reason: "invalid-email" }],
    [["password", "--generate"], { ok: false, reason: "not-found" }],
    [["password", "--generate"], { ok: false, reason: "password-too-short", min: 8, max: 128 }],
    [["deactivate"], { ok: false, reason: "not-found" }],
    [["activate"], { ok: false, reason: "not-found" }],
  ] as const)("%j answering %j exits non-zero and names the address", async ([command, ...flags], result) => {
    const h = harness({ result });
    const code = await run([command, TEACHER.email, ...flags], h.io, h.operations);

    expect(code).toBe(EXIT_REFUSED);
    expect(h.out).toEqual([]);
    if (!result.reason.startsWith("password-")) {
      expect(h.err.join("\n")).toContain(TEACHER.email);
    }
  });

  it("does not print a generated password for an account that was not written", async () => {
    const h = harness({ result: { ok: false, reason: "not-found" } });
    await run(["password", TEACHER.email, "--generate"], h.io, h.operations);

    expect([...h.out, ...h.err].join("\n")).not.toContain("generated-password-1234");
  });
});

describe("deactivate and activate", () => {
  it.each(["deactivate", "activate"])("%s calls its operation with the address", async (command) => {
    const h = harness();
    const code = await run([command, TEACHER.email], h.io, h.operations);

    expect(code).toBe(EXIT_OK);
    expect(h.calls).toEqual([[command, TEACHER.email]]);
    expect(h.prompts).toEqual([]);
  });
});

describe("list", () => {
  it("prints each teacher's address, name, whether active and when created", async () => {
    const h = harness();
    const code = await run(["list"], h.io, h.operations);

    expect(code).toBe(EXIT_OK);
    expect(h.out).toEqual([
      "olena@example.test\tОлена Шевченко\tactive\t2026-09-01T08:00:00.000Z",
      "ivan@example.test\tОлена Шевченко\tdeactivated\t2026-09-01T08:00:00.000Z",
    ]);
  });
});

describe("a command line that is wrong", () => {
  it.each([
    [[]],
    [["delete", TEACHER.email]],
    [["create"]],
    [["deactivate"]],
    [["list", "extra"]],
    [["create", TEACHER.email, "--name"]],
    [["deactivate", TEACHER.email, "--generate"]],
  ])("%j exits with the usage code and calls nothing", async (argv) => {
    const h = harness();
    const code = await run(argv, h.io, h.operations);

    expect(code).toBe(EXIT_USAGE);
    expect(h.calls).toEqual([]);
    expect(h.err.join("\n")).toContain("Usage:");
  });
});
