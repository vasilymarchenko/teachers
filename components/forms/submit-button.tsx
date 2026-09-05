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
  confirm,
}: {
  children: string;
  pendingLabel: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  /**
   * Asked before the form is submitted, when this submission would destroy
   * something the teacher typed and no button on the screen brings it back —
   * the same guard, and the same accepted cost with JavaScript off, as
   * `DeleteButton`. Omitted where the write is undoable.
   */
  confirm?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (confirm !== undefined && !window.confirm(confirm)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
