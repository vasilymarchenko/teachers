"use client";

/**
 * The message about a submission as a whole — a constraint the database
 * refused, a row that disappeared. `FormField` shows the ones that belong to a
 * single field.
 *
 * `role="alert"` because it appears after the teacher pressed the button: it is
 * the answer to what she just did, and a screen reader has to say so.
 */
export function FormMessage({ children }: { children?: string }) {
  if (!children) return null;

  return (
    <p role="alert" className="text-destructive text-sm">
      {children}
    </p>
  );
}
