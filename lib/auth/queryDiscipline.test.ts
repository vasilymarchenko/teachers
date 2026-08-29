import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSource, type SourceKind, type Violation } from "./queryDiscipline";

/**
 * The `userId` discipline of overview §8.4, enforced rather than agreed.
 *
 * Two halves. The first walks the repository: every file under the three
 * directories must be clean, and a new query that forgets `userId` fails here
 * rather than in review. The second feeds the checker sources that are supposed
 * to fail — without it a checker that returned `[]` unconditionally would look
 * like a passing suite forever.
 */

const SCANNED: { dir: string; kind: SourceKind }[] = [
  { dir: "lib/db/queries", kind: "query" },
  { dir: "lib/actions", kind: "action" },
  { dir: "lib/validation", kind: "validation" },
];

function tsFilesIn(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return []; // A directory that does not exist yet has nothing to violate.
  }

  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsFilesIn(path);
    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) return [];
    if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) return [];
    return [path];
  });
}

function describeViolations(violations: Violation[]): string {
  return violations.map((v) => `${v.file}:${v.line} — ${v.message}`).join("\n");
}

describe("the repository", () => {
  for (const { dir, kind } of SCANNED) {
    const files = tsFilesIn(dir);

    it(`has files to check in ${dir}`, () => {
      // Guards against the walk silently finding nothing — a renamed directory
      // would otherwise turn this whole suite into a no-op that still passes.
      expect(files.length).toBeGreaterThan(0);
    });

    for (const file of files) {
      it(`${file} keeps the userId discipline`, () => {
        const violations = checkSource(file, readFileSync(file, "utf8"), kind);
        expect(describeViolations(violations)).toBe("");
      });
    }
  }
});

describe("the checker itself", () => {
  const messagesFor = (source: string, kind: SourceKind) =>
    checkSource("fixture.ts", source, kind).map((v) => v.message);

  it("accepts a query that takes userId first", () => {
    const source = `
      export async function listThings(userId: string, from: string) {
        return [userId, from];
      }
    `;
    expect(messagesFor(source, "query")).toEqual([]);
  });

  it("rejects a query whose first parameter is something else", () => {
    const source = `
      export async function getThing(id: string, userId: string) {
        return [id, userId];
      }
    `;
    expect(messagesFor(source, "query")).toEqual([
      "getThing()'s first parameter must be named userId",
    ]);
  });

  it("rejects a query that takes no parameters at all", () => {
    expect(messagesFor("export async function listAll() {}", "query")).toEqual([
      "listAll() takes no parameters; a query takes userId first",
    ]);
  });

  it("rejects an untyped userId", () => {
    const source = "export async function listThings(userId) { return userId; }";
    expect(messagesFor(source, "query")).toEqual([
      "listThings()'s userId must be declared `userId: string`",
    ]);
  });

  it("checks an exported arrow function too", () => {
    const source = "export const listThings = async (id: string) => [id];";
    expect(messagesFor(source, "query")).toEqual([
      "listThings()'s first parameter must be named userId",
    ]);
  });

  it("rejects userId read out of a FormData", () => {
    const source = `
      export async function saveThing(formData: FormData) {
        const userId = formData.get("userId");
        return userId;
      }
    `;
    expect(messagesFor(source, "action")).toContain(
      "userId is read out of request input; it comes only from requireUser()",
    );
  });

  it("rejects userId read off a parameter", () => {
    const source = `
      export async function saveThing(userId: string, input: { userId: string }) {
        return input.userId;
      }
    `;
    expect(messagesFor(source, "query")).toEqual([
      "userId is read off the parameter `input`; it comes only from requireUser()",
    ]);
  });

  it("rejects userId read off a destructured parameter", () => {
    const source = `
      export async function saveThing(userId: string, { body }: { body: { userId: string } }) {
        return body.userId;
      }
    `;
    expect(messagesFor(source, "query")).toEqual([
      "userId is read off the parameter `body`; it comes only from requireUser()",
    ]);
  });

  it("rejects a Zod schema that declares userId", () => {
    const source = `
      export const thingInput = z.object({ userId: z.string(), title: z.string() });
    `;
    expect(messagesFor(source, "validation")).toEqual([
      "a Zod schema declares userId; validating it does not make it trusted",
    ]);
  });

  it("rejects a Server Action that never reaches the boundary", () => {
    const source = `
      export async function saveThing(formData: FormData) {
        return formData.get("title");
      }
    `;
    expect(messagesFor(source, "action")).toEqual([
      "saveThing() does not call requireUser(); a Server Action starts at the " +
        "authorisation boundary, or is named in ACTIONS_WITHOUT_A_SESSION",
    ]);
  });

  it("accepts a Server Action that starts at the boundary", () => {
    const source = `
      export async function saveThing(formData: FormData) {
        const { id } = await requireUser();
        return [id, formData.get("title")];
      }
    `;
    expect(messagesFor(source, "action")).toEqual([]);
  });

  it("allows signInAction, which runs before a session exists", () => {
    const source = `
      export async function signInAction(state: unknown, formData: FormData) {
        return [state, formData.get("email")];
      }
    `;
    expect(messagesFor(source, "action")).toEqual([]);
  });

  it("leaves a query's own userId parameter alone", () => {
    // The identifier `userId` is not a property read; only `x.userId` is.
    const source = `
      export async function listThings(userId: string) {
        return userId;
      }
    `;
    expect(messagesFor(source, "query")).toEqual([]);
  });
});
