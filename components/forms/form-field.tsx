"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A label, a control and the message that belongs to that control.
 *
 * Every form of T-009 renders its fields through this, and so does the sign-in
 * form: the wiring is the part that is easy to get subtly wrong — `htmlFor`
 * pointing at the input, `aria-invalid` on it, `aria-describedby` pointing at
 * the message — and it is worth having in one place rather than in each form.
 *
 * The control is a render prop rather than a child so that the id and the ARIA
 * attributes reach it without the caller having to repeat them; a caller passes
 * an `Input`, a `Select` or anything else that takes them.
 */
export type FieldControlProps = {
  id: string;
  name: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

export function FormField({
  name,
  label,
  error,
  hint,
  className,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  /** Standing guidance under the control — not a message about this submission. */
  hint?: string;
  className?: string;
  children: (props: FieldControlProps) => React.ReactNode;
}) {
  // Ids are generated because one screen renders the same field name in many
  // rows: a literal `id={name}` would repeat `dateFrom` down the page and point
  // every label at the first input.
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : undefined, hint ? hintId : undefined]
    .filter((value) => value !== undefined)
    .join(" ");

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy === "" ? undefined : describedBy,
      })}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
