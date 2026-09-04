import type { ZodError } from "zod";

/**
 * What a Server Action hands back to the form it was submitted from — the
 * shape `useActionState` carries, shared by every form of T-009.
 *
 * It exists in `lib/validation` rather than in `lib/actions` for a mechanical
 * reason: every exported function of `lib/actions` must reach `requireUser()`
 * (overview §8.3), and `lib/auth/queryDiscipline.test.ts` fails the build over a
 * helper that does not. A helper about the *boundary between the form and the
 * schema* belongs on the schema's side anyway.
 *
 * `undefined` everywhere means "nothing to report"; an action that succeeds
 * returns `{}` and the form renders clean.
 */
export type FormState = {
  /** A message about the submission as a whole — a constraint, a missing row. */
  error?: string;
  /** One message per field name, as the form spells it in `name=`. */
  fieldErrors?: Record<string, string>;
  /**
   * What was submitted, echoed back so the form can restore it.
   *
   * React resets an uncontrolled form once its action resolves, so without this
   * a teacher who mistyped one date would get every field of the row back
   * empty. Same reasoning as the sign-in form's echoed address
   * (`lib/actions/auth.ts`); nothing here is a secret, so the whole submission
   * goes back.
   */
  values?: Record<string, string>;
};

export const EMPTY_FORM_STATE: FormState = {};

/**
 * The submitted fields as plain strings.
 *
 * `Object.fromEntries(formData)` also yields React's own `$ACTION_*` entries
 * and any `File` a form might carry; both are dropped, so what comes back is
 * what the form put in.
 */
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value !== "string") continue;
    values[key] = value;
  }
  return values;
}

/**
 * A failed `safeParse` as form state.
 *
 * Only the first message per field is kept: the field shows one line, and a
 * teacher fixing the first problem gets the second one on the next submission.
 * An issue with no path — a cross-field `refine` that did not name one — lands
 * in `error`, which is why every refine in this directory sets `path`.
 */
export function invalidInput(error: ZodError, formData: FormData): FormState {
  const fieldErrors: Record<string, string> = {};
  let formError: string | undefined;

  for (const issue of error.issues) {
    const [field] = issue.path;
    if (typeof field === "string") {
      fieldErrors[field] ??= issue.message;
    } else {
      formError ??= issue.message;
    }
  }

  return { error: formError, fieldErrors, values: submittedValues(formData) };
}

/** A refusal that is not about one field: a constraint, a missing parent row. */
export function rejected(message: string, formData: FormData): FormState {
  return { error: message, values: submittedValues(formData) };
}

/** A refusal that is about one field, phrased by the caller. */
export function rejectedField(
  field: string,
  message: string,
  formData: FormData,
): FormState {
  return { fieldErrors: { [field]: message }, values: submittedValues(formData) };
}
