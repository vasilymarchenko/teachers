import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A styled native `<select>`.
 *
 * Deliberately not shadcn/ui's Radix listbox: every select in the year setup
 * chooses between three to seven fixed values, a phone renders the native
 * control better than any recreation of it, and a `<select>` inside a `<form>`
 * submits without JavaScript — which is the property the whole screen is built
 * on. The cost is that the options cannot be styled; none of them need to be.
 *
 * An uncontrolled select is remounted when its `defaultValue` changes. React
 * applies a select's `defaultValue` only at mount, and resets a form after
 * every action — so without the remount, a save that changed the selected
 * option would put the old option back on screen while the new one is stored,
 * and the next save of any other field would write it back. The remount also
 * keeps the rendered default true for `TrackedForm`, whose record it is
 * (T-047). It happens only when the default changes, which is after an action,
 * never while the teacher is choosing.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      key={props.defaultValue === undefined ? undefined : String(props.defaultValue)}
      data-slot="select"
      className={cn(
        "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { Select };
