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
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
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
