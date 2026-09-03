import { z } from "zod";
import { PARITY_VALUES } from "./enums";
import { isoDateField } from "./fields";

/**
 * The parity-reset form — specification §4, `parity_anchor` in schema §4.6.
 *
 * «Скидання після канікул»: from this date the alternation starts again from
 * the chosen value. There is no separate reset entity — the year's initial
 * value and every reset are the same `ParityAnchor` (overview §3.5), so this
 * form and the year form write the same table. The one thing that separates
 * them is the date: the anchor on the year's first day is the initial value and
 * belongs to the year form, which is why the action refuses a reset dated
 * there.
 *
 * An anchor need not fall on a Monday (schema §4.6); `parityOn()` handles a
 * mid-week anchor, and fixtures §5 F-1 pins what it does.
 */
export const parityAnchorInput = z.object({
  date: isoDateField("Виберіть дату, з якої починається новий відлік"),
  parity: z.enum(PARITY_VALUES, "Оберіть, з чого починається відлік"),
});

/**
 * `Form` in the name because `lib/domain/schedule/types.ts` already owns
 * `ParityAnchorInput` — what `parityOn()` reads.
 */
export type ParityAnchorFormInput = z.infer<typeof parityAnchorInput>;

export const PARITY_ANCHOR_FIELD = {
  date: "date",
  parity: "parity",
} as const satisfies Record<keyof ParityAnchorFormInput, string>;
