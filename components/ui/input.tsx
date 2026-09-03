import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The text, date and time input of the year-setup forms.
 *
 * A plain `<input>` with the shell's tokens, matching `Button`: no Radix
 * primitive, because a native `date` or `time` input is what gives a phone its
 * own date picker (specification §8, overview §10.2) and what keeps the forms
 * working with JavaScript off.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
