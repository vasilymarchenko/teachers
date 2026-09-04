import type { FormState } from "@/lib/validation/formState";

/**
 * What an input should show: what was submitted, or what the row holds.
 *
 * React resets an uncontrolled form when its action resolves, so a form that
 * was refused comes back empty unless the submission is put back into it —
 * `FormState.values` is what the actions echo for exactly this. The stored
 * value is the fallback, which is what an edit form shows the first time and
 * what an add form shows after a successful submission cleared the state.
 */
export function fieldValue(
  state: FormState,
  name: string,
  fallback: string | number = "",
): string {
  return state.values?.[name] ?? String(fallback);
}
