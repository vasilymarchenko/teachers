import { describe, expect, it } from "vitest";
import type { SetupStatus } from "@/lib/db/queries/setupStatus";
import { SETUP_GATE } from "./labels";
import { nextSetupStep, setupSteps } from "./setup-steps";

/**
 * Which item of the year setup is next, and where on `/year` it is entered —
 * overview §8.6, T-041.
 *
 * The states are the ones a new teacher walks through, in the order the page
 * presents them: nothing at all; the year saved with its initial parity; both
 * semesters; the bell schedule. The expectations are the four conditions of
 * §8.6 read in that order, not values taken from a run.
 */

const YEAR = "year-1";

function status(fields: Partial<SetupStatus> = {}): SetupStatus {
  return { complete: false, hasBellSchedule: false, years: [], ...fields };
}

const yearWith = (hasBothSemesters: boolean) => ({
  academicYearId: YEAR,
  hasInitialAnchor: true,
  hasBothSemesters,
});

describe("setupSteps", () => {
  it("lists the four items in the order the page presents them", () => {
    expect(setupSteps(status(), null).map((step) => step.key)).toStrictEqual([
      "academicYear",
      "initialParity",
      "semesters",
      "bellSchedule",
    ]);
  });

  it("with no year, sends every year item to the year's section", () => {
    // The semesters' section is not on the page until a year exists.
    const steps = setupSteps(status(), null);
    expect(steps.map((step) => [step.key, step.done, step.href])).toStrictEqual([
      ["academicYear", false, "#year-bounds"],
      ["initialParity", false, "#year-bounds"],
      ["semesters", false, "#year-bounds"],
      ["bellSchedule", false, "#bells"],
    ]);
    expect(nextSetupStep(steps)?.label).toBe(SETUP_GATE.items.academicYear);
  });

  it("after the year is saved, the semesters are next and link to their section", () => {
    const steps = setupSteps(status({ years: [yearWith(false)] }), YEAR);
    expect(steps.map((step) => [step.key, step.done, step.href])).toStrictEqual([
      ["academicYear", true, "#year-bounds"],
      ["initialParity", true, "#year-bounds"],
      ["semesters", false, "#semesters"],
      ["bellSchedule", false, "#bells"],
    ]);
    expect(nextSetupStep(steps)).toMatchObject({
      label: SETUP_GATE.items.semesters,
      href: "#semesters",
    });
  });

  it("after both semesters, the bell schedule is next", () => {
    const steps = setupSteps(status({ years: [yearWith(true)] }), YEAR);
    expect(nextSetupStep(steps)).toMatchObject({
      label: SETUP_GATE.items.bellSchedule,
      href: "#bells",
    });
  });

  it("with the bell schedule first, the semesters are still next", () => {
    const steps = setupSteps(
      status({ hasBellSchedule: true, years: [yearWith(false)] }),
      YEAR,
    );
    expect(nextSetupStep(steps)?.key).toBe("semesters");
  });

  it("has nothing next once all four are there", () => {
    const steps = setupSteps(
      status({ complete: true, hasBellSchedule: true, years: [yearWith(true)] }),
      YEAR,
    );
    expect(steps.every((step) => step.done)).toBe(true);
    expect(nextSetupStep(steps)).toBeNull();
  });

  it("reports the year being edited, not another one", () => {
    // A second year being prepared, with nothing in it yet, is the one on
    // screen: its items are what the forms below can fill in.
    const steps = setupSteps(status({ years: [yearWith(true)] }), "year-2");
    expect(nextSetupStep(steps)?.key).toBe("academicYear");
  });
});
