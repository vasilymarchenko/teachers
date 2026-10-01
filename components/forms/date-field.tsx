"use client";

import type { FormErrors } from "@/components/forms/field-errors";
import { FormField } from "@/components/forms/form-field";
import { fieldValue } from "@/components/forms/values";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/validation/formState";

/**
 * A date input wired to a form's state — the shape every year-setup section
 * repeats, since every entity of the year frame is a range or a point in time.
 *
 * `type="date"` gives a phone its own picker and submits `YYYY-MM-DD`, which is
 * exactly what `isoDateField` parses and what the `date` columns store
 * (overview §8.5).
 */
export function DateField({
  name,
  label,
  state,
  stored,
  errors,
  hint,
  required = true,
}: {
  name: string;
  label: string;
  state: FormState;
  /** What the row holds today; absent on a form that adds one. */
  stored?: string;
  /** The form's errors; the field takes its own out of them. */
  errors: FormErrors;
  hint?: string;
  required?: boolean;
}) {
  return (
    <FormField error={errors.for(name)} hint={hint} label={label} name={name}>
      {(props) => (
        <Input
          {...props}
          type="date"
          required={required}
          defaultValue={fieldValue(state, name, stored)}
        />
      )}
    </FormField>
  );
}
