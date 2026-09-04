"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * The button that submits a form and says so while the action runs.
 *
 * `useFormStatus` has to be read by a child of the form rather than by the form
 * itself, which is the whole reason this is a component and not two lines
 * inside each one.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant,
}: {
  children: string;
  pendingLabel: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
