import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LESSON_ROW_LAYOUT } from "./lessonRowLayout";

/**
 * The week view's overflow of T-021, pinned — a convention, enforced rather
 * than agreed, in the shape `lib/auth/queryDiscipline.test.ts` and
 * `lib/db/postgresImage.test.ts` already use.
 *
 * What it can check and what it cannot. There is no DOM environment in this
 * project (`vitest.config.mts` says so, and ADR-013 says why the ticket did not
 * add one), so nothing here measures a bounding rect: the subject of the test is
 * the three properties that make the overflow impossible, each of which is a
 * property of the source.
 *
 * 1. The narrow-card form exists and is reached through **one** threshold. A
 *    second, different threshold would reflow half the row and leave the other
 *    half in the wide form — the exact defect, at a different width.
 * 2. `DayLessons` opens the container the row's `@max-[…]` variants resolve
 *    against. Without it every one of those variants is inert and the row keeps
 *    the wide form in a 95 px card. This is the silent failure: the classes are
 *    still in the source, the stylesheet still has the rules, and nothing
 *    matches.
 * 3. The payload side can wrap. `min-w-0` alone lets the box shrink while the
 *    text keeps its own width, which is how «Інформатика» ended up 57 px over
 *    the neighbouring day.
 */

const ROW = "components/calendar/lesson-row.tsx";
const DAY_LESSONS = "components/calendar/day-lessons.tsx";

function source(file: string): string {
  return readFileSync(file, "utf8");
}

/** Every container-query threshold named in a class string, e.g. `14rem`. */
function thresholdsIn(classes: string): string[] {
  return [...classes.matchAll(/@max-\[([^\]]+)\]:/g)].map(([, size]) => size);
}

const ALL_CLASSES = Object.values(LESSON_ROW_LAYOUT).join(" ");

describe("the lesson row's narrow-card form", () => {
  it("is reached through exactly one threshold", () => {
    const thresholds = new Set(thresholdsIn(ALL_CLASSES));

    expect([...thresholds]).toHaveLength(1);
  });

  it("reflows the row, the number-and-time column and the separator", () => {
    // Each of the three has to change at the threshold: the row stops being a
    // side-by-side flex, the fixed 64 px column gives up its width, and the
    // two bell times gain the dash that joins them on one line.
    expect(thresholdsIn(LESSON_ROW_LAYOUT.row)).not.toHaveLength(0);
    expect(thresholdsIn(LESSON_ROW_LAYOUT.timeColumn)).not.toHaveLength(0);
    expect(thresholdsIn(LESSON_ROW_LAYOUT.timeSeparator)).not.toHaveLength(0);
  });

  it("keeps the number and its bell times — the column is reflowed, not dropped", () => {
    // Criterion 2 of the ticket: the fix constrains the payload side. `w-16` is
    // still the wide form's column, and `w-auto` is what it becomes.
    expect(LESSON_ROW_LAYOUT.timeColumn).toContain("w-16");
    expect(LESSON_ROW_LAYOUT.timeColumn).toMatch(/@max-\[[^\]]+\]:w-auto/);
    expect(LESSON_ROW_LAYOUT.timeColumn).toMatch(/@max-\[[^\]]+\]:flex-wrap/);
  });

  it("lets the payload and the subject wrap instead of painting outside the card", () => {
    expect(LESSON_ROW_LAYOUT.payload).toContain("min-w-0");
    expect(LESSON_ROW_LAYOUT.payload).toContain("break-words");
    expect(LESSON_ROW_LAYOUT.subject).toContain("min-w-0");
    expect(LESSON_ROW_LAYOUT.subject).toContain("break-words");
  });
});

describe("the components", () => {
  it("open the container on the day, so the row's variants can match", () => {
    expect(LESSON_ROW_LAYOUT.container).toBe("@container");
    expect(source(DAY_LESSONS)).toContain("LESSON_ROW_LAYOUT.container");
  });

  it("take the row's layout from the one module that holds it", () => {
    const row = source(ROW);

    for (const key of ["row", "timeColumn", "payload", "subject"]) {
      expect(row).toContain(`LESSON_ROW_LAYOUT.${key}`);
    }
  });

  it("hard-code no container-query threshold of their own", () => {
    // A threshold written into a component is a second definition of the
    // breakpoint, and the first thing to drift away from this module.
    expect(thresholdsIn(source(ROW))).toEqual([]);
    expect(thresholdsIn(source(DAY_LESSONS))).toEqual([]);
  });

  it("give the subject a title, so the full name is reachable when it wraps", () => {
    expect(source(ROW)).toContain("title={lesson.payload.subject}");
  });
});
