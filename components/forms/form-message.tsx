"use client";

import type { FormErrors } from "@/components/forms/field-errors";

/**
 * The message about a submission as a whole — a constraint the database
 * refused, a row that disappeared — and every field message no control on this
 * form asked for (`formErrorsOf()`, overview §8.2). `FormField` shows the ones
 * that belong to a single field.
 *
 * It takes the form's `FormErrors` and nothing else, so a form cannot show its
 * form-level message without also showing what would otherwise be lost. Render
 * it after the controls: what is unclaimed is only known once they have asked.
 *
 * `role="alert"` because it appears after the teacher pressed the button: it is
 * the answer to what she just did, and a screen reader has to say so.
 */
export function FormMessage({ errors }: { errors: FormErrors }) {
  const messages = errors.unclaimed();
  if (messages.length === 0) return null;

  return (
    <div role="alert" className="text-destructive space-y-1 text-sm">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}

/**
 * A field's message beside a control `FormField` does not wrap — a group of
 * radio buttons under one legend. The caller passes `errors.for(name)`.
 */
export function FieldMessage({ children }: { children?: string }) {
  if (!children) return null;

  return (
    <p role="alert" className="text-destructive text-sm">
      {children}
    </p>
  );
}
