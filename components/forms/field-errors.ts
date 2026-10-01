/**
 * The errors of one submission, handed out so that none of them can be lost —
 * overview §8.2, ADR-024.
 *
 * An action keys a field error by the `name=` it expects the form to spell
 * (`FormState.fieldErrors`), but it cannot always know which form submitted: a
 * day save and a parity copy reach the same boundary refusal the boundary form
 * does, and neither renders a boundary control. A message keyed to a field the
 * form does not render used to render nowhere — the teacher pressed «Зберегти»
 * and the screen did not move.
 *
 * So a form does not read `fieldErrors` itself. It asks for each message with
 * `for(name)` as it renders the control the message belongs to, and
 * `FormMessage` prints `unclaimed()` — the message about the submission as a
 * whole, plus every field message no control asked for.
 *
 * `for()` records the name it was asked about. That is a mutation during
 * render, and a safe one: the object is made anew in the render that uses it
 * and is never kept between renders, so rendering twice gives the same result.
 * It is also why this works with JavaScript off — everything happens in the one
 * pass that produces the HTML. What it asks of a form is that `FormMessage`
 * comes after the controls, which is where a form-level message goes anyway.
 */
export type FormErrors = {
  /** The message for one field, which the caller now owes the screen. */
  for(name: string): string | undefined;
  /** The form-level message, then every field message nothing asked for. */
  unclaimed(): string[];
};

/** The part of an action's answer that reports errors — `FormState` has it, and so does the sign-in state. */
type ReportedErrors = {
  error?: string;
  fieldErrors?: Readonly<Record<string, string | undefined>>;
};

export function formErrorsOf(state: ReportedErrors): FormErrors {
  const claimed = new Set<string>();

  return {
    for(name) {
      claimed.add(name);
      return state.fieldErrors?.[name];
    },
    unclaimed() {
      const messages: string[] = [];
      if (state.error) messages.push(state.error);
      for (const [name, message] of Object.entries(state.fieldErrors ?? {})) {
        if (message && !claimed.has(name)) messages.push(message);
      }
      return messages;
    },
  };
}
