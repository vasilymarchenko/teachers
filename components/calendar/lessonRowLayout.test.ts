import { execFileSync } from "node:child_process";
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
 * 2. **Every** file that renders a `LessonRow` opens the container its
 *    `@max-[…]` variants resolve against. Without it those variants are inert
 *    and the row keeps the wide form in a 95 px card. This is the silent
 *    failure: the classes are still in the source, the stylesheet still has the
 *    rules, and nothing matches. Naming one file here would have left the
 *    lesson editor of T-011 out, which is where it was found.
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
    expect(thresholdsIn(LESSON_ROW_LAYOUT.timeRange)).not.toHaveLength(0);
    expect(thresholdsIn(LESSON_ROW_LAYOUT.timeSeparator)).not.toHaveLength(0);
  });

  it("keeps the number and its bell times — the column is reflowed, not dropped", () => {
    // Criterion 2 of the ticket: the fix constrains the payload side. `w-16` is
    // still the wide form's column, and `w-auto` is what it becomes.
    expect(LESSON_ROW_LAYOUT.timeColumn).toContain("w-16");
    expect(LESSON_ROW_LAYOUT.timeColumn).toMatch(/@max-\[[^\]]+\]:w-auto/);
    expect(LESSON_ROW_LAYOUT.timeColumn).toMatch(/@max-\[[^\]]+\]:flex-wrap/);
  });

  it("keeps the two bell times together as one wrap item", () => {
    // The column wraps; the range inside it must not, or «08:30–09:15» breaks
    // as «08:30 –» over «09:15» — a dash hanging off the end of a line.
    expect(LESSON_ROW_LAYOUT.timeRange).toContain("flex");
    expect(LESSON_ROW_LAYOUT.timeRange).not.toContain("flex-wrap");
    expect(LESSON_ROW_LAYOUT.timeColumn).toMatch(/@max-\[[^\]]+\]:gap-x/);
  });

  it("lets the payload and the subject wrap instead of painting outside the card", () => {
    expect(LESSON_ROW_LAYOUT.payload).toContain("min-w-0");
    expect(LESSON_ROW_LAYOUT.payload).toContain("break-words");
    expect(LESSON_ROW_LAYOUT.subject).toContain("min-w-0");
    expect(LESSON_ROW_LAYOUT.subject).toContain("break-words");
  });
});

/** Every tracked file that renders a `<LessonRow`, the row's own source aside. */
function filesRenderingTheRow(): string[] {
  const found = execFileSync(
    "git",
    ["grep", "-l", "--", "<LessonRow", "app", "components"],
    { encoding: "utf8" },
  );

  return found
    .split("\n")
    .filter(
      (file) => file !== "" && file !== ROW && !file.endsWith(".test.ts"),
    );
}

describe("the components", () => {
  const renderers = filesRenderingTheRow();

  it("are found at all", () => {
    // A renamed directory would otherwise turn the loop below into a loop over
    // nothing, which passes without checking anything.
    expect(renderers.length).toBeGreaterThan(0);
  });

  it("declare the container and the wrapping rule on one class", () => {
    expect(LESSON_ROW_LAYOUT.container).toContain("@container");
    // Inherited, so it reaches the card's other free text as well — an event
    // title, a note, the name of a non-teaching period.
    expect(LESSON_ROW_LAYOUT.container).toContain("break-words");
  });

  for (const file of renderers) {
    it(`${file} opens the container the row reflows against`, () => {
      expect(source(file)).toContain("LESSON_ROW_LAYOUT.container");
    });
  }

  it("take the row's layout from the one module that holds it", () => {
    const row = source(ROW);

    for (const key of ["row", "timeColumn", "payload", "subject"]) {
      expect(row).toContain(`LESSON_ROW_LAYOUT.${key}`);
    }
  });

  it("hard-code no container-query threshold of their own", () => {
    // A threshold written into a component is a second definition of the
    // breakpoint, and the first thing to drift away from this module.
    for (const file of [ROW, DAY_LESSONS, ...renderers]) {
      expect(thresholdsIn(source(file))).toEqual([]);
    }
  });

  it("leave the subject its whole text rather than a tooltip of it", () => {
    // The name wraps at the card's full width and is never clipped, so the
    // whole of it is on the screen. A `title` repeating visible text becomes
    // the accessible description, and the row is read out twice.
    expect(source(ROW)).not.toContain("title={lesson.payload.subject}");
  });
});
