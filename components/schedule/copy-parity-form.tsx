"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { copyParityAction } from "@/lib/actions/scheduleTemplate";
import type { Parity, ScheduleView } from "@/lib/db/schema/enums";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import { useFormStatus } from "react-dom";
import { COPY_LABELS, COPY_SECTION } from "./labels";

/**
 * «Скопіювати з чисельника» and its opposite — specification §5.1.
 *
 * One button, and it says which way it goes: it copies **from** the parity week
 * the screen is showing into the other one, so the direction follows the parity
 * switch and both directions of specification §5.1 are one switch apart. A
 * select plus a «Виконати» would make the teacher read the sentence twice to
 * see what is about to be overwritten.
 *
 * The confirmation is a `confirm()` because the action is destructive in a way
 * nothing else on this screen is — it replaces a whole week — and unlike the
 * day form there is nothing on the screen that shows what is about to be lost.
 * With JavaScript off there is no dialogue and the copy goes straight through,
 * the same accepted cost `DeleteButton` carries.
 */
export function CopyParityForm({
  view,
  from,
  to,
}: {
  view: ScheduleView;
  from: Parity;
  to: Parity;
}) {
  const [state, formAction] = useActionState(
    copyParityAction.bind(null, view, from, to),
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="space-y-2">
      <CopyButton label={COPY_LABELS[from]} />
      <FormMessage>{state.error}</FormMessage>
    </form>
  );
}

function CopyButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(COPY_SECTION.confirm)) event.preventDefault();
      }}
      type="submit"
      variant="outline"
    >
      {pending ? COPY_SECTION.pending : label}
    </Button>
  );
}
