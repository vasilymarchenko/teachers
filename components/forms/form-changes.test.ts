import { describe, expect, it } from "vitest";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import {
  createChangeTracker,
  formChanged,
  reasonShown,
  sameFields,
  submitAvailability,
  type FieldEntries,
} from "./form-changes";

/**
 * T-047: an edit form's «Зберегти» is available only while the form holds
 * something to save.
 *
 * The suite has no DOM (`vitest.config.mts`), so the form here is what the
 * tracker actually depends on: something events are dispatched at — Node's own
 * `EventTarget` — and a reading of the submitted fields, which in the browser
 * is `new FormData(form)`. Each case changes the reading the way the browser
 * would and dispatches the event the browser would.
 */
function fakeForm(initial: [string, string][]) {
  const target = new EventTarget();
  let fields = initial;
  const reports: boolean[] = [];

  const tracker = createChangeTracker({
    target,
    read: () => fields,
    onChange: (changed) => reports.push(changed),
  });

  return {
    tracker,
    /** The teacher (or code) set the fields; the browser fires `type`. */
    set(next: [string, string][], type: "input" | "change" = "input") {
      fields = next;
      target.dispatchEvent(new Event(type, { bubbles: true }));
    },
    /** The fields changed with no event at all — React re-rendered the form. */
    replace(next: [string, string][]) {
      fields = next;
    },
    /** `form.reset()`: the event first, the defaults back afterwards. */
    reset(defaults: [string, string][]) {
      target.dispatchEvent(new Event("reset"));
      fields = defaults;
    },
    get changed() {
      return reports.at(-1) ?? false;
    },
  };
}

const STORED: [string, string][] = [
  ["dateFrom", "2026-09-01"],
  ["dateTo", "2026-12-24"],
];

describe("sameFields()", () => {
  it("compares names and values in order", () => {
    expect(sameFields(STORED, [...STORED])).toBe(true);
    expect(sameFields(STORED, [STORED[0], ["dateTo", "2026-12-25"]])).toBe(false);
  });

  it("counts a repeated name once per occurrence", () => {
    const twice: FieldEntries = [
      ["subject", "Алгебра"],
      ["subject", "Алгебра"],
    ];
    expect(sameFields(twice, [["subject", "Алгебра"]])).toBe(false);
  });

  it("drops an untracked field from both sides", () => {
    expect(
      sameFields(
        [...STORED, ["bothWeeks", "on"]],
        STORED,
        ["bothWeeks"],
      ),
    ).toBe(true);
  });
});

describe("createChangeTracker()", () => {
  it("reports an edit", () => {
    const form = fakeForm(STORED);
    form.set([STORED[0], ["dateTo", "2026-12-25"]]);
    expect(form.changed).toBe(true);
  });

  it("reads as unchanged again once the edit is reverted", () => {
    const form = fakeForm(STORED);
    form.set([STORED[0], ["dateTo", "2026-12-25"]]);
    form.set(STORED);
    expect(form.changed).toBe(false);
  });

  it("reports a cleared field", () => {
    const form = fakeForm(STORED);
    form.set([STORED[0], ["dateTo", ""]]);
    expect(form.changed).toBe(true);
  });

  // A checkbox submits its value only while it is ticked.
  it("reports a checkbox ticked, and not once it is unticked again", () => {
    const form = fakeForm(STORED);
    form.set([...STORED, ["done", "on"]], "change");
    expect(form.changed).toBe(true);
    form.set(STORED, "change");
    expect(form.changed).toBe(false);
  });

  // The information event's form swaps «Останній день» for the two boundary
  // fields when a repetition is chosen, and back again — fields the page adds
  // and removes with no event of their own. `TrackedForm` calls `check()` from
  // a `MutationObserver` for exactly this.
  it("compares a field added by the page on check()", () => {
    const form = fakeForm(STORED);
    form.replace([...STORED, ["boundaryKind", "NEXT_BREAK"]]);
    expect(form.changed).toBe(false);
    form.tracker.check();
    expect(form.changed).toBe(true);
    form.replace(STORED);
    form.tracker.check();
    expect(form.changed).toBe(false);
  });

  // The contract for a value set from code (a clear by icon, T-046; a value
  // normalised on blur): it dispatches a bubbling `input` event, and nothing
  // else is needed.
  it("sees a value set from code by the input event it dispatches", () => {
    const form = fakeForm([["subject", "Алгебра"]]);
    form.replace([["subject", ""]]);
    expect(form.changed).toBe(false);
    form.set([["subject", ""]], "input");
    expect(form.changed).toBe(true);
  });

  it("compares a reset once the defaults are back, not when it fires", async () => {
    const form = fakeForm(STORED);
    form.set([STORED[0], ["dateTo", "2026-12-25"]]);
    form.reset(STORED);
    expect(form.changed).toBe(true);
    await Promise.resolve();
    expect(form.changed).toBe(false);
  });

  // T-043's «both weeks» toggle on a row equal in both weeks: it changes how
  // the save is written, not what it writes.
  it("does not count an untracked field", () => {
    const form = fakeForm(STORED);
    form.tracker.setUntracked(["bothWeeks"]);
    form.set([...STORED, ["bothWeeks", "on"]], "change");
    expect(form.changed).toBe(false);
  });

  it("keeps the record after a refusal, so the form still reads as changed", () => {
    const form = fakeForm(STORED);
    const edited: [string, string][] = [STORED[0], ["dateTo", "2027-06-30"]];
    form.set(edited);
    // React resets the form to the echoed submission, then the effect settles.
    form.replace(edited);
    form.tracker.settle({
      fieldErrors: { dateTo: "Поза межами року" },
      values: Object.fromEntries(edited),
    });
    expect(form.changed).toBe(true);
  });

  it("takes the record again after a success, so the form reads as unchanged", () => {
    const form = fakeForm(STORED);
    const saved: [string, string][] = [STORED[0], ["dateTo", "2026-12-25"]];
    form.set(saved);
    // The re-rendered form holds what is now stored.
    form.replace(saved);
    form.tracker.settle({});
    expect(form.changed).toBe(false);
  });

  it("stops listening once disposed", () => {
    const form = fakeForm(STORED);
    form.tracker.dispose();
    form.set([STORED[0], ["dateTo", "2026-12-25"]]);
    expect(form.changed).toBe(false);
  });
});

describe("formChanged()", () => {
  // A symbolic boundary that now resolves elsewhere (overview §8.1): the page
  // says so, and the form opens as changed with every field as it was.
  it("opens as changed when the page says a save would rewrite the boundary", () => {
    expect(
      formChanged({ changedOnOpen: true, reported: undefined, compared: false }),
    ).toBe(true);
  });

  it("opens as unchanged when the stored boundary is current", () => {
    expect(
      formChanged({ changedOnOpen: false, reported: undefined, compared: false }),
    ).toBe(false);
  });

  it("takes a controlled form's report over the DOM comparison", () => {
    expect(
      formChanged({ changedOnOpen: false, reported: false, compared: true }),
    ).toBe(false);
    expect(
      formChanged({ changedOnOpen: false, reported: true, compared: false }),
    ).toBe(true);
  });
});

describe("submitAvailability()", () => {
  const base = { tracked: true, hydrated: true, changed: false, pending: false };

  it("is available outside an opted-in form", () => {
    expect(submitAvailability({ ...base, tracked: false })).toBe("available");
  });

  // With JavaScript off the page never hydrates, and the form saves as before.
  it("is available before hydration", () => {
    expect(submitAvailability({ ...base, hydrated: false })).toBe("available");
  });

  it("is unavailable while the form is unchanged", () => {
    expect(submitAvailability(base)).toBe("unchanged");
  });

  it("is available once the form changes", () => {
    expect(submitAvailability({ ...base, changed: true })).toBe("available");
  });

  it("is pending while the action runs, changed or not", () => {
    expect(submitAvailability({ ...base, pending: true })).toBe("pending");
    expect(
      submitAvailability({ ...base, changed: true, pending: true }),
    ).toBe("pending");
  });
});

describe("reasonShown()", () => {
  it("says nothing until the muted button is activated", () => {
    expect(reasonShown(false, { type: "changed", changed: false })).toBe(false);
    expect(
      reasonShown(false, { type: "activated", availability: "unchanged" }),
    ).toBe(true);
  });

  it("does not answer a press while a save is running", () => {
    expect(
      reasonShown(false, { type: "activated", availability: "pending" }),
    ).toBe(false);
  });

  it("goes away once the form changes", () => {
    expect(reasonShown(true, { type: "changed", changed: true })).toBe(false);
  });

  it("stays while the form is still unchanged", () => {
    expect(reasonShown(true, { type: "changed", changed: false })).toBe(true);
  });
});

it("reads the initial state as a clean save", () => {
  const form = fakeForm(STORED);
  form.tracker.settle(EMPTY_FORM_STATE);
  expect(form.changed).toBe(false);
});
