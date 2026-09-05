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
 * Over a plain template lesson it needs no confirmation: the cancellation is
 * visible on the calendar immediately, «Повернути урок» beside it deletes the
 * tombstone and the template lesson comes back untouched, so a dialogue would
 * guard against nothing.
 *
 * Over an `EDIT` or a `SUBSTITUTION` it is not undoable, and that is what
 * `overwrites` marks. Cancelling upserts the **same** row to `CLEARED` with
 * `payload = NULL` (`lib/actions/dayOverride.ts`), so the lesson the teacher
 * typed is gone; «Повернути урок» then restores the *weekly template's* lesson,
 * not hers. That is text of her own with no button to bring it back — the
 * condition `RemoveOverrideForm` already confirms on.
 */
export function ClearLessonForm({
  slot,
  overwrites = false,
}: {
  slot: Slot;
  /** An override carrying a payload sits on this slot and would be replaced. */
  overwrites?: boolean;
}) {
  const [state, formAction] = useActionState(
    clearLessonAction.bind(null, slot),
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton
        confirm={overwrites ? OVERRIDE_LABELS.clearConfirm : undefined}
        pendingLabel={OVERRIDE_LABELS.clearing}
        variant="outline"
      >
        {OVERRIDE_LABELS.clear}
      </SubmitButton>
      <p className="text-muted-foreground text-xs">
        {overwrites ? OVERRIDE_LABELS.clearOverwritesHint : OVERRIDE_LABELS.clearHint}
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
 * three different reasons (glossary §3). This one confirms whenever what it
 * removes is text the teacher typed, and there is no button to bring it back.
 *
 * What it leaves behind is **not** always a lesson: an override written through
 * «Додати урок» sits on a slot the weekly template does not fill, and removing
 * it leaves the date empty. `restoresPlanned` is what the screen read off
 * `buildPlannedDays()`, so the wording promises only what will happen.
 */
export function RemoveOverrideForm({
  slot,
  kind,
  restoresPlanned,
}: {
  slot: Slot;
  kind: DayOverrideKind;
  /** The weekly template gives a lesson on this slot, so removal restores it. */
  restoresPlanned: boolean;
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
        confirm={
          restoresPlanned
            ? OVERRIDE_LABELS.removeConfirm
            : OVERRIDE_LABELS.removeConfirmNoPlanned
        }
        label={REMOVE_OVERRIDE_LABELS[kind]}
      />
      <p className="text-muted-foreground text-xs">
        {restoresPlanned
          ? OVERRIDE_LABELS.removeHint
          : OVERRIDE_LABELS.removeHintNoPlanned}
      </p>
      <FormMessage>{state.error}</FormMessage>
    </form>
  );
}
