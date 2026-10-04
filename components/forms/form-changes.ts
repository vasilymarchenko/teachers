import type { FormState } from "@/lib/validation/formState";

/**
 * Whether an edit form holds unsaved changes — T-047, overview §8.2.
 *
 * Nothing here touches the DOM: the tracker is given something to listen on
 * and a way to read the fields, so the rules — what "changed" means, when the
 * record is taken again, what a value set from code has to do — are tested in
 * the `node` environment the suite runs in. `TrackedForm` is the browser side:
 * it hands over the `<form>` and `new FormData(form)`.
 */

/** A form's submitted fields, in document order, as `FormData` lists them. */
export type FieldEntries = readonly (readonly [name: string, value: string])[];

/**
 * Whether two readings of a form submit the same thing.
 *
 * Compared as lists, not as maps: a checkbox is in the list when it is ticked
 * and absent when it is not, and a name that repeats — two rows with the same
 * field — counts once per row. `untracked` names are dropped from both sides
 * before comparing, so a field that changes how the save is written but not
 * what it writes cannot make the form changed on its own.
 */
export function sameFields(
  record: FieldEntries,
  current: FieldEntries,
  untracked: readonly string[] = [],
): boolean {
  const kept = (entries: FieldEntries) =>
    entries.filter(([name]) => !untracked.includes(name));
  const a = kept(record);
  const b = kept(current);

  return (
    a.length === b.length &&
    a.every(([name, value], index) => {
      const [otherName, otherValue] = b[index];
      return name === otherName && value === otherValue;
    })
  );
}

/**
 * A save that went through. Every action returns `{}` on success and a state
 * with a message and the echoed submission on a refusal (`FormState`), so the
 * absence of all three is the success, and `EMPTY_FORM_STATE` reads as one —
 * which is right: it is the form as the page rendered it.
 */
export function savedCleanly(state: FormState): boolean {
  return (
    state.error === undefined &&
    state.fieldErrors === undefined &&
    state.values === undefined
  );
}

export type ChangeTracker = {
  /** Compares the current fields against the record. */
  check(): void;
  /**
   * The page rendered the form again — its own save, another form's save that
   * changed what this one shows, a field the page added. The record is taken
   * again from the defaults the form now renders, unless the form is showing a
   * refusal: then its defaults are the echoed submission, and the record that
   * submission is measured against is kept.
   */
  refresh(): void;
  /**
   * The form's action resolved. A success ends the refusal, if there was one,
   * and the re-rendered form is the record, so it reads as unchanged; a
   * refusal keeps the record, so the submission React put back into the fields
   * still reads as changed.
   */
  settle(state: FormState): void;
  /** Replaces the fields left out of the comparison. */
  setUntracked(names: readonly string[]): void;
  dispose(): void;
};

/**
 * Compares a form's fields with the record of what it rendered, and reports,
 * through `onChange`, every time the answer to "do they differ?" flips.
 *
 * The record is `readDefaults()` — what the form would submit if it were reset
 * to what the page rendered — not the fields as they are: a value typed before
 * hydration, or kept across a re-render that changed what is stored, is a
 * change and must read as one.
 *
 * It listens to `input`, `change` and `reset` on `target` and to nothing else.
 * That is the contract for a value set from code — a clear by icon, a value
 * normalised on blur: the code dispatches a bubbling `input` event on the field
 * it changed, and the tracker needs no other notification. `reset` fires before
 * the browser puts the default values back, so it is compared a microtask
 * later.
 */
export function createChangeTracker({
  target,
  read,
  readDefaults,
  untracked: initialUntracked = [],
  onChange,
}: {
  target: EventTarget;
  read: () => FieldEntries;
  readDefaults: () => FieldEntries;
  untracked?: readonly string[];
  onChange: (changed: boolean) => void;
}): ChangeTracker {
  let record = readDefaults();
  let refused = false;
  let untracked = initialUntracked;
  let changed = false;

  const check = () => {
    const now = !sameFields(record, read(), untracked);
    if (now === changed) return;
    changed = now;
    onChange(changed);
  };
  const checkAfterReset = () => queueMicrotask(check);

  target.addEventListener("input", check);
  target.addEventListener("change", check);
  target.addEventListener("reset", checkAfterReset);

  // A form that opens with a value typed before hydration has to say so.
  check();

  return {
    check,
    refresh() {
      if (!refused) record = readDefaults();
      check();
    },
    settle(state) {
      refused = !savedCleanly(state);
      if (!refused) record = readDefaults();
      check();
    },
    setUntracked(names) {
      untracked = names;
      check();
    },
    dispose() {
      target.removeEventListener("input", check);
      target.removeEventListener("change", check);
      target.removeEventListener("reset", checkAfterReset);
    },
  };
}

/**
 * The form's answer, from its three sources.
 *
 * `changedOnOpen` is the page's, decided on the server: saving the form as it
 * opened would still write something new — a symbolic boundary that now
 * resolves elsewhere (overview §8.1) — so it reads as changed even with every
 * field as it was, and stays so until the page says otherwise. Otherwise a
 * controlled form's own `reported` answer replaces the DOM comparison.
 */
export function formChanged({
  changedOnOpen,
  reported,
  compared,
}: {
  changedOnOpen: boolean;
  reported: boolean | undefined;
  compared: boolean;
}): boolean {
  return changedOnOpen || (reported ?? compared);
}

/**
 * What `SubmitButton` is, in the four situations it can be in.
 *
 *  - Outside an opted-in form, or before hydration: `available`. That is the
 *    button as it was before T-047, and what a page with JavaScript off keeps.
 *  - A save running: `pending`, whether or not the form is changed.
 *  - Nothing to save: `unchanged`.
 */
export type SubmitAvailability = "available" | "pending" | "unchanged";

export function submitAvailability({
  tracked,
  hydrated,
  changed,
  pending,
}: {
  tracked: boolean;
  hydrated: boolean;
  changed: boolean;
  pending: boolean;
}): SubmitAvailability {
  if (pending) return "pending";
  if (!tracked || !hydrated) return "available";
  return changed ? "available" : "unchanged";
}

/**
 * Whether the muted button says why nothing was saved.
 *
 * Nothing is said until the teacher activates the button while there is
 * nothing to save; it is said from then until the form changes. A press while
 * a save is running is not answered: that button is busy, not muted for want
 * of changes.
 */
export function reasonShown(
  shown: boolean,
  event:
    | { type: "activated"; availability: SubmitAvailability }
    | { type: "changed"; changed: boolean },
): boolean {
  if (event.type === "changed") return event.changed ? false : shown;
  return event.availability === "unchanged" ? true : shown;
}
