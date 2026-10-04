"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { FormState } from "@/lib/validation/formState";
import {
  createChangeTracker,
  formChanged,
  type ChangeTracker,
  type FieldEntries,
} from "./form-changes";

/**
 * What `SubmitButton` reads from the form around it. `null` outside an
 * opted-in form, where the button behaves as it always has.
 */
type FormChanges = { hydrated: boolean; changed: boolean };

const FormChangesContext = createContext<FormChanges | null>(null);

/** The changed state of the opted-in form this is rendered inside, if any. */
export function useFormChanges(): FormChanges | null {
  return useContext(FormChangesContext);
}

/**
 * A `<form>` that knows whether it holds unsaved changes — T-047, overview
 * §8.2.
 *
 * A form opts in when it opens filled with stored or planned values: an edit
 * form, never one that adds a row. Its `SubmitButton` is then unavailable
 * while the fields still submit what the form opened with. The inputs stay
 * uncontrolled: the record is the `FormData` the form would submit if reset to
 * the defaults it renders, taken again on every render, and the comparison
 * runs on the form's `input`, `change` and `reset` events
 * (`createChangeTracker()`), plus a `MutationObserver` for a field the page
 * adds or removes without an event of its own.
 *
 * So a DOM-compared form renders every control uncontrolled, with a default.
 * Not a controlled input: React writes its current value into the `value`
 * attribute, the reset copy reads that back as the default, and the record
 * would follow every keystroke — the form would never read as changed. Not a
 * controlled `<select>` either: mounted on the client, it marks no option as
 * the default, and its record would be the first option. A form that has to
 * control its state reports `changed` itself.
 *
 * `tracked={false}` renders a plain form, so one component serves a form that
 * both adds and edits rows and opts in only for the second.
 */
export function TrackedForm({
  tracked = true,
  state,
  changedOnOpen = false,
  changed: reported,
  untracked,
  children,
  ...formProps
}: Omit<React.ComponentProps<"form">, "action"> & {
  action: (formData: FormData) => void;
  tracked?: boolean;
  /** The form's `useActionState` result: a success retakes the record. */
  state: FormState;
  /**
   * The page decided on the server that saving this form unchanged would still
   * write something different from what is stored — a symbolic boundary that
   * now resolves elsewhere (overview §8.1). The form then reads as changed for
   * as long as the page says so.
   */
  changedOnOpen?: boolean;
  /**
   * A controlled form's own answer, computed from its state against the stored
   * rows. When given, the DOM comparison is not run at all.
   */
  changed?: boolean;
  /** Field names left out of the comparison. */
  untracked?: readonly string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const trackerRef = useRef<ChangeTracker | null>(null);
  const hydrated = useHydrated();
  const [domChanged, setDomChanged] = useState(false);
  const controlled = reported !== undefined;
  const active = tracked && !controlled;

  useEffect(() => {
    const form = formRef.current;
    if (!active || form === null) return;

    const tracker = createChangeTracker({
      target: form,
      read: () => fieldsOf(form),
      readDefaults: () => defaultFieldsOf(form),
      onChange: setDomChanged,
    });
    const observer = new MutationObserver(() => tracker.refresh());
    observer.observe(form, { childList: true, subtree: true });
    trackerRef.current = tracker;

    return () => {
      observer.disconnect();
      tracker.dispose();
      trackerRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    trackerRef.current?.setUntracked(untracked ?? []);
  }, [untracked]);

  // React resets an uncontrolled form in the commit that delivers the action's
  // result, before effects run — so the fields read here are already the
  // re-rendered form's.
  const settled = useRef(state);
  useEffect(() => {
    if (settled.current === state) return;
    settled.current = state;
    trackerRef.current?.settle(state);
  }, [state]);

  // Every other render may carry new defaults too: another form's save that
  // changed what this one shows — a removed override, a sibling day's rows —
  // with this form mounted throughout. Reading the defaults is cheap, and a
  // record that did not change leaves the answer as it was.
  useEffect(() => {
    trackerRef.current?.refresh();
  });

  const form = (
    <form {...formProps} ref={formRef}>
      {children}
    </form>
  );
  if (!tracked) return form;

  const changed = formChanged({
    changedOnOpen,
    reported,
    compared: domChanged,
  });
  return (
    <FormChangesContext value={{ hydrated, changed }}>{form}</FormChangesContext>
  );
}

/**
 * `false` in the server render and in the hydrating one, `true` after — so the
 * button is available in the HTML a page with JavaScript off keeps, and the
 * two renders that hydration compares agree.
 */
const subscribeToNothing = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/**
 * The fields the form would submit if it were reset — the defaults the page
 * rendered. Read from a detached copy, because resetting the form itself would
 * throw away what the teacher typed: a cloned control keeps its default
 * (`value` attribute, `defaultChecked`, `defaultSelected`), and `reset()` on the
 * copy puts every one of them back without an event reaching the page.
 */
function defaultFieldsOf(form: HTMLFormElement): FieldEntries {
  const copy = form.cloneNode(true) as HTMLFormElement;
  copy.reset();
  return fieldsOf(copy);
}

/** The submitted fields, as the browser would submit them. */
function fieldsOf(form: HTMLFormElement): FieldEntries {
  const entries: [string, string][] = [];
  for (const [name, value] of new FormData(form)) {
    // React's own hidden inputs for a server action, and a `File`, which no
    // form here carries; neither is something the teacher typed.
    if (name.startsWith("$ACTION") || typeof value !== "string") continue;
    entries.push([name, value]);
  }
  return entries;
}
