import type { SetupStatus } from "@/lib/db/queries/setupStatus";
import { SETUP_GATE } from "./labels";

/**
 * The year-setup checklist as data — overview §8.6, T-041.
 *
 * What the checklist at the top of `/year` and the bar at the bottom of it
 * both read, so the two cannot disagree about which item is next. The
 * conditions are not restated: each item is one flag of `getSetupStatus()`,
 * given the words a teacher reads and the section of the page where it is
 * entered.
 *
 * Pure and DB-free, so it is tested without rendering anything
 * (`setup-steps.test.ts`).
 */

/**
 * The `id` of each section a setup item is entered in — the target of the
 * checklist's links and of the bar's «Перейти». One name per section, used by
 * the section that carries it and by nothing else but this file.
 */
export const SETUP_ANCHORS = {
  year: "year-bounds",
  semesters: "semesters",
  bells: "bells",
} as const;

export type SetupStepKey = keyof typeof SETUP_GATE.items;

export type SetupStep = {
  key: SetupStepKey;
  /** What the teacher fills in, as the checklist words it. */
  label: string;
  done: boolean;
  /** The section of `/year` where it is entered, as a fragment: `#…`. */
  href: string;
};

/**
 * The four items, in the order the page presents their sections: the year's
 * bounds and its initial parity in the first form, the semesters below it, the
 * bell schedule near the end.
 *
 * Reported for the year the page is editing, because that is the year whose
 * forms are on screen. The semesters are entered inside a year, and their
 * section is not rendered until one exists — so with no year yet their link
 * leads to the year's section, where the year has to be added first.
 */
export function setupSteps(
  status: SetupStatus,
  academicYearId: string | null,
): SetupStep[] {
  const year = status.years.find(
    (candidate) => candidate.academicYearId === academicYearId,
  );
  const yearHref = `#${SETUP_ANCHORS.year}`;

  return [
    {
      key: "academicYear",
      label: SETUP_GATE.items.academicYear,
      done: year !== undefined,
      href: yearHref,
    },
    {
      key: "initialParity",
      label: SETUP_GATE.items.initialParity,
      done: year?.hasInitialAnchor ?? false,
      href: yearHref,
    },
    {
      key: "semesters",
      label: SETUP_GATE.items.semesters,
      done: year?.hasBothSemesters ?? false,
      href: year === undefined ? yearHref : `#${SETUP_ANCHORS.semesters}`,
    },
    {
      key: "bellSchedule",
      label: SETUP_GATE.items.bellSchedule,
      done: status.hasBellSchedule,
      href: `#${SETUP_ANCHORS.bells}`,
    },
  ];
}

/** The first item still missing, or `null` when all four are there. */
export function nextSetupStep(steps: readonly SetupStep[]): SetupStep | null {
  return steps.find((step) => !step.done) ?? null;
}
