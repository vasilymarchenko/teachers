"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { reasonShown, submitAvailability } from "./form-changes";
import { useFormChanges } from "./tracked-form";

/**
 * Why the muted button saved nothing — shown beside it once it has been
 * pressed with nothing to save (T-047).
 */
export const UNCHANGED_REASON = "Немає змін, які треба зберегти";

/**
 * The button that submits a form and says so while the action runs.
 *
 * `useFormStatus` has to be read by a child of the form rather than by the form
 * itself, which is the whole reason this is a component and not two lines
 * inside each one.
 *
 * Inside a `TrackedForm` it is also unavailable while the form holds nothing
 * to save (T-047, overview §8.2). Unavailable is `aria-disabled`, not
 * `disabled`: the button stays in the tab order and answers a press — a click,
 * a tap, Enter in a field, which the browser turns into a click — by
 * submitting nothing and saying why, where a `disabled` one would swallow the
 * press without a word. Outside a `TrackedForm`, and before hydration, it is
 * the button it always was.
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
  const changes = useFormChanges();
  const reasonId = useId();

  const availability = submitAvailability({
    tracked: changes !== null,
    hydrated: changes?.hydrated ?? false,
    changed: changes?.changed ?? false,
    pending,
  });

  // The reason goes away once the form changes: the render-time adjustment
  // React documents for state that follows a prop, no effect involved.
  const [shown, setShown] = useState(false);
  const changed = changes?.changed ?? false;
  const [seenChanged, setSeenChanged] = useState(changed);
  if (seenChanged !== changed) {
    setSeenChanged(changed);
    setShown(reasonShown(shown, { type: "changed", changed }));
  }

  if (changes === null) {
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

  const muted = availability !== "available";

  return (
    <>
      <Button
        type="submit"
        variant={variant}
        // Muted the way `disabled:` mutes a button, without `pointer-events-none`:
        // the press has to arrive to be answered.
        className={cn(className, muted && "cursor-not-allowed opacity-50")}
        aria-disabled={muted ? true : undefined}
        aria-describedby={shown ? reasonId : undefined}
        onClick={(event) => {
          if (muted) {
            event.preventDefault();
            setShown(reasonShown(shown, { type: "activated", availability }));
            return;
          }
          if (confirm !== undefined && !window.confirm(confirm)) {
            event.preventDefault();
          }
        }}
      >
        {pending ? pendingLabel : children}
      </Button>
      <span
        className="text-muted-foreground self-center text-sm"
        id={reasonId}
        role="status"
      >
        {shown ? UNCHANGED_REASON : null}
      </span>
    </>
  );
}
