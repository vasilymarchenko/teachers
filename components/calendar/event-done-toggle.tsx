"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { setEventDoneAction } from "@/lib/actions/events";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import { DONE_LABELS } from "@/components/events/labels";

/**
 * «Позначити виконаним» / «Зняти позначку» — marking a deadline done from the
 * calendar (specification §6.3, T-012).
 *
 * It is a form and an action rather than a link, because it writes; and it
 * answers as `FormState` rather than as a bare `void` action, so that a
 * deadline deleted in another window comes back as a message instead of as a
 * button that appears to do nothing.
 *
 * Offered in the day and week views only — the two views a lesson and its date
 * are legible in, and the two T-011 edits from (ADR-008). A month cell and a
 * year cell open the day instead.
 */
export function EventDoneToggle({
  eventId,
  done,
}: {
  eventId: string;
  done: boolean;
}) {
  const [state, formAction] = useActionState(
    setEventDoneAction.bind(null, eventId, !done),
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction}>
      <button
        className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
        type="submit"
      >
        {done ? DONE_LABELS.markNotDone : DONE_LABELS.markDone}
      </button>
      <FormMessage>{state.error}</FormMessage>
    </form>
  );
}
