"use client";

import { useActionState } from "react";
import { DeleteButton } from "@/components/forms/delete-button";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  clearLessonAction,
  removeDayOverrideAction,
} from "@/lib/actions/dayOverride";
import type { DayOverrideKind, ScheduleView } from "@/lib/db/schema/enums";
import type { IsoDate } from "@/lib/time/today";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import { OVERRIDE_LABELS, REMOVE_OVERRIDE_LABELS } from "./labels";

/**
 * The two writes of the override editor that carry no payload — T-011.
 *
 * They are two separate forms rather than two buttons of the payload form: each
 * has its own `useActionState`, so a refusal is shown under the button that was
 * pressed, and neither has to submit the lesson's fields to do its job. That
 * also keeps «Скасувати урок» working when those fields are empty, which is the
 * state a teacher cancelling a lesson is usually in.
 */

/** The slot the buttons act on — the URL of the screen, never form input. */
type Slot = { date: IsoDate; view: ScheduleView; lessonNumber: number };

/**
 * «Скасувати урок» — the tombstone of specification §5.3.
 *
 * No confirmation: the cancellation is visible on the calendar immediately and
 * is undone by the button beside it, so a dialogue would guard against nothing.
 * The hint says what cancelling does, which is the part a teacher cannot guess:
 * the lesson stays on the screen, struck through.
 */
export function ClearLessonForm({ slot }: { slot: Slot }) {
  const [state, formAction] = useActionState(
    clearLessonAction.bind(null, slot),
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton pendingLabel={OVERRIDE_LABELS.clearing} variant="outline">
        {OVERRIDE_LABELS.clear}
      </SubmitButton>
      <p className="text-muted-foreground text-xs">
        {OVERRIDE_LABELS.clearHint}
      </p>
      <FormMessage>{state.error}</FormMessage>
    </form>
  );
}

/**
 * «Прибрати правку» / «Прибрати заміну» / «Повернути урок» — the override row
 * is deleted and the weekly template applies to the date again.
 *
 * Named after what is being removed, because the three kinds are undone for
 * three different reasons (glossary §3). This one does confirm: unlike a
 * cancellation, what it removes is text the teacher typed, and there is no
 * button to bring it back.
 */
export function RemoveOverrideForm({
  slot,
  kind,
}: {
  slot: Slot;
  kind: DayOverrideKind;
}) {
  const [state, formAction] = useActionState(
    removeDayOverrideAction.bind(null, slot),
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="space-y-2">
      {/* The whole form is the delete, so the button needs no `formAction` of
          its own — see `DeleteButton`. */}
      <DeleteButton
        confirm={OVERRIDE_LABELS.removeConfirm}
        label={REMOVE_OVERRIDE_LABELS[kind]}
      />
      <p className="text-muted-foreground text-xs">
        {OVERRIDE_LABELS.removeHint}
      </p>
      <FormMessage>{state.error}</FormMessage>
    </form>
  );
}
