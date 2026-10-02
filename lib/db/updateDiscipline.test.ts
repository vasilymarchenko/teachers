import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkUpdates,
  MISSING_RETURNING,
  RESULT_DISCARDED,
  RESULT_NEVER_READ,
} from "./updateDiscipline";

/**
 * One row of `docs/architecture/design/T-009-year-setup.md` §5, enforced rather
 * than agreed:
 *
 * > | an UPDATE that matched no row (deleted in another tab) | the action, via
 * > `.returning()` | Drizzle reports success for an UPDATE that matched nothing |
 *
 * Two halves, like `lib/auth/queryDiscipline.test.ts`. The first walks
 * `lib/actions`: every `.update(` chain there must read what it matched, and a
 * new one that forgets fails here rather than in review. The second feeds the
 * checker sources that are supposed to fail — without it a checker that found
 * no `.update(` at all would look like a passing suite forever.
 */

const ACTIONS = "lib/actions";

/**
 * The update actions T-009 wrote — the four the rule was first stated for, two
 * of which missed it. Each must still hold an UPDATE for the walk to count as
 * having checked them.
 */
const T009_UPDATE_ACTIONS = [
  "lib/actions/academicYear.ts",
  "lib/actions/semesters.ts",
  "lib/actions/nonTeachingPeriods.ts",
  "lib/actions/weekdayRules.ts",
];

function actionFiles(): string[] {
  return readdirSync(ACTIONS, { recursive: true, encoding: "utf8" })
    .filter((entry) => /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
    // Forward slashes on every platform: the paths are compared against the
    // list above and printed in a failure, and `readdirSync` hands back `\` on
    // Windows.
    .map((entry) => `${ACTIONS}/${entry.replaceAll("\\", "/")}`)
    .sort();
}

const reportFor = (file: string) => checkUpdates(file, readFileSync(file, "utf8"));

describe("the repository", () => {
  const files = actionFiles();

  it(`has files to check in ${ACTIONS}`, () => {
    // Guards against the walk silently finding nothing — a renamed directory
    // would otherwise turn this whole suite into a no-op that still passes.
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} reads what every UPDATE matched`, () => {
      const described = reportFor(file)
        .violations.map((v) => `${v.file}:${v.line}  ${v.message}`)
        .join("\n");
      expect(described).toBe("");
    });
  }

  for (const file of T009_UPDATE_ACTIONS) {
    it(`finds an UPDATE to check in ${file}`, () => {
      // A clean report over a file the checker saw no `.update(` in is not a
      // pass. If the action moved, move this list with it.
      expect(files).toContain(file);
      expect(reportFor(file).updates).toBeGreaterThan(0);
    });
  }
});

describe("the checker itself", () => {
  const check = (source: string) => checkUpdates("fixture.ts", source);
  const messagesFor = (source: string) => check(source).violations.map((v) => v.message);

  it("rejects an UPDATE with no .returning()", () => {
    const source = `
      export async function updateThingAction(id: string) {
        await getDb()
          .update(thing)
          .set({ title })
          .where(eq(thing.id, id));
        return {};
      }
    `;
    expect(check(source)).toEqual({
      updates: 1,
      violations: [{ file: "fixture.ts", line: 4, message: MISSING_RETURNING }],
    });
  });

  it("rejects the shape updateAcademicYearAction had before T-009's review", () => {
    // An UPDATE inside a transaction, followed by another write, with nothing
    // between them that could notice the year was gone.
    const source = `
      export async function updateAcademicYearAction(id: string) {
        await getDb().transaction(async (tx) => {
          await tx
            .update(academicYear)
            .set({ dateFrom, dateTo })
            .where(and(eq(academicYear.userId, userId), eq(academicYear.id, id)));

          await tx.insert(parityAnchor).values({ userId, date: dateFrom, parity });
        });
      }
    `;
    expect(check(source)).toEqual({
      updates: 1,
      violations: [{ file: "fixture.ts", line: 5, message: MISSING_RETURNING }],
    });
  });

  it("rejects a .returning() whose result is discarded", () => {
    const source = `
      export async function updateThingAction(id: string) {
        await getDb().update(thing).set({ title }).where(eq(thing.id, id)).returning();
      }
    `;
    expect(messagesFor(source)).toEqual([RESULT_DISCARDED]);
  });

  it("rejects a .returning() whose result is bound and never read", () => {
    const source = `
      export async function updateThingAction(id: string) {
        const updated = await getDb()
          .update(thing)
          .set({ title })
          .where(eq(thing.id, id))
          .returning({ id: thing.id });
        return {};
      }
    `;
    expect(messagesFor(source)).toEqual([RESULT_NEVER_READ]);
  });

  it("does not take a property of the same name for a read", () => {
    const source = `
      export async function updateThingAction(id: string) {
        const updated = await getDb().update(thing).set({ title }).returning();
        return { updated: other.updated };
      }
    `;
    expect(messagesFor(source)).toEqual([RESULT_NEVER_READ]);
  });

  it("accepts an UPDATE whose empty result returns a message", () => {
    const source = `
      export async function updateThingAction(id: string) {
        const updated = await getDb()
          .update(thing)
          .set({ title })
          .where(eq(thing.id, id))
          .returning({ id: thing.id });

        if (updated.length === 0) return rejected(THING_NOT_FOUND, formData);
        return {};
      }
    `;
    expect(check(source)).toEqual({ updates: 1, violations: [] });
  });

  it("accepts an UPDATE in a transaction whose empty result throws", () => {
    const source = `
      export async function updateThingAction(id: string) {
        await getDb().transaction(async (tx) => {
          const updated = await tx
            .update(thing)
            .set({ title })
            .where(eq(thing.id, id))
            .returning({ id: thing.id });

          if (updated.length === 0) throw new ThingVanished();
        });
      }
    `;
    expect(messagesFor(source)).toEqual([]);
  });

  it("accepts a destructured row that is read", () => {
    const source = `
      export async function updateThingAction(id: string) {
        const [row] = await getDb().update(thing).set({ title }).returning();
        if (row === undefined) return rejected(THING_NOT_FOUND, formData);
        return {};
      }
    `;
    expect(messagesFor(source)).toEqual([]);
  });

  it("accepts a result read where it stands", () => {
    const source = `
      export async function updateThingAction(id: string) {
        if ((await getDb().update(thing).set({ title }).returning()).length === 0) {
          return rejected(THING_NOT_FOUND, formData);
        }
        return {};
      }
    `;
    expect(messagesFor(source)).toEqual([]);
  });

  it("accepts an explicit row-count check in place of .returning()", () => {
    const source = `
      export async function updateThingAction(id: string) {
        const result = await getDb().update(thing).set({ title }).where(eq(thing.id, id));
        if (result.count === 0) return rejected(THING_NOT_FOUND, formData);
        return {};
      }
    `;
    expect(messagesFor(source)).toEqual([]);
  });

  it("rejects a check of rowCount, which the postgres-js result does not have", () => {
    // `lib/db/client.ts` runs on drizzle-orm/postgres-js: the number of rows is
    // `count`. `rowCount` is node-postgres's name, is `undefined` here, and
    // `undefined === 0` never fires.
    const source = `
      export async function updateThingAction(id: string) {
        const result = await getDb().update(thing).set({ title }).where(eq(thing.id, id));
        if (result.rowCount === 0) return rejected(THING_NOT_FOUND, formData);
        return {};
      }
    `;
    expect(messagesFor(source)).toEqual([MISSING_RETURNING]);
  });

  it("accepts a first row tested where it stands", () => {
    const source = `
      export async function updateThingAction(id: string) {
        if (!(await getDb().update(thing).set({ title }).returning())[0]) {
          return rejected(THING_NOT_FOUND, formData);
        }
        return {};
      }
    `;
    expect(messagesFor(source)).toEqual([]);
  });

  it("rejects a result returned out of a transaction nobody keeps", () => {
    // The caller a `return` hands the rows to is right here, and throws them
    // away: a deleted row comes back as a clean save.
    const source = `
      export async function updateThingAction(id: string) {
        await getDb().transaction(async (tx) => {
          return tx.update(thing).set({ title }).where(eq(thing.id, id)).returning();
        });
        return {};
      }
    `;
    expect(messagesFor(source)).toEqual([RESULT_DISCARDED]);
  });

  it("rejects a result returned from a helper, awaited or not", () => {
    const source = `
      async function trim(tx: Tx) {
        return await tx.update(thing).set({ validTo }).returning();
      }
      const trimAll = (tx: Tx) => tx.update(thing).set({ validTo }).returning();
    `;
    expect(messagesFor(source)).toEqual([RESULT_DISCARDED, RESULT_DISCARDED]);
  });

  it("gives a bound result the verdict the unbound one gets", () => {
    const unbound = `
      export async function updateThingAction() {
        logger.info(await getDb().update(thing).set({ title }).returning());
        return {};
      }
    `;
    const bound = `
      export async function updateThingAction() {
        const updated = await getDb().update(thing).set({ title }).returning();
        logger.info(updated);
        return {};
      }
    `;
    expect(messagesFor(unbound)).toEqual([RESULT_DISCARDED]);
    expect(messagesFor(bound)).toEqual([RESULT_NEVER_READ]);
  });

  it("does not take an assignment or a type member of the same name for a read", () => {
    const assigned = `
      export async function updateThingAction() {
        let updated = await getDb().update(thing).set({ title }).returning();
        updated = [];
        return {};
      }
    `;
    const typed = `
      export async function updateThingAction() {
        const updated = await getDb().update(thing).set({ title }).returning();
        type Outcome = { updated: string };
        return {};
      }
    `;
    expect(messagesFor(assigned)).toEqual([RESULT_NEVER_READ]);
    expect(messagesFor(typed)).toEqual([RESULT_NEVER_READ]);
  });

  it("rejects a result handed somewhere nobody can be seen reading it", () => {
    const source = `
      export async function updateThingsAction() {
        await Promise.all([
          getDb().update(thing).set({ title }).returning(),
        ]);
      }
    `;
    expect(messagesFor(source)).toEqual([RESULT_DISCARDED]);
  });

  it("rejects a discarded result behind satisfies", () => {
    const source = `
      export async function updateThingAction() {
        (await getDb().update(thing).set({ title }).returning()) satisfies Row[];
      }
    `;
    expect(messagesFor(source)).toEqual([RESULT_DISCARDED]);
  });

  it("follows a result out of a conditional into the name it is bound to", () => {
    const unread = `
      export async function updateThingAction() {
        const updated = dirty ? await getDb().update(thing).set({ title }).returning() : [];
        return {};
      }
    `;
    const read = `
      export async function updateThingAction() {
        const updated = dirty ? await getDb().update(thing).set({ title }).returning() : [];
        if (dirty && updated.length === 0) return rejected(THING_NOT_FOUND, formData);
        return {};
      }
    `;
    expect(messagesFor(unread)).toEqual([RESULT_NEVER_READ]);
    expect(messagesFor(read)).toEqual([]);
  });

  it("rejects a result bound without .returning() whose row count is not read", () => {
    const source = `
      export async function updateThingAction(id: string) {
        const result = await getDb().update(thing).set({ title }).where(eq(thing.id, id));
        return { result };
      }
    `;
    expect(messagesFor(source)).toEqual([MISSING_RETURNING]);
  });

  it("reports each offending UPDATE in a file, and only those", () => {
    const source = `
      export async function firstAction() {
        const updated = await getDb().update(thing).set({ title }).returning();
        if (updated.length === 0) return rejected(THING_NOT_FOUND, formData);
        return {};
      }
      export async function secondAction() {
        await getDb().update(thing).set({ title });
      }
      export async function thirdAction() {
        await getDb().update(thing).set({ done });
      }
    `;
    const report = check(source);
    expect(report.updates).toBe(3);
    expect(report.violations.map((v) => v.line)).toEqual([8, 11]);
  });

  it("does not check a DELETE", () => {
    // The rule in §5 is about UPDATE. That is this checker's limit, not a
    // verdict on deletes — see the header of `updateDiscipline.ts`.
    const source = `
      export async function deleteThingAction(id: string) {
        await getDb().delete(thing).where(eq(thing.id, id));
      }
    `;
    expect(check(source)).toEqual({ updates: 0, violations: [] });
  });

  it("leaves an upsert alone", () => {
    const source = `
      export async function saveThingAction(id: string) {
        await getDb()
          .insert(thing)
          .values({ id, title })
          .onConflictDoUpdate({ target: thing.id, set: { title } });
      }
    `;
    expect(check(source)).toEqual({ updates: 0, violations: [] });
  });
});
