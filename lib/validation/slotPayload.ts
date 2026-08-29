import { z } from "zod";
import type { ScheduleView } from "@/lib/db/schema/enums";

/**
 * The one place a slot payload's shape is checked — `docs/architecture/design/schema.md` §7.
 *
 * `template_slot.payload` and `day_override.payload` are `jsonb`: the database
 * enforces that a payload is present (and, for an override, that it is absent
 * exactly for `CLEARED`) and nothing about its contents. That is what lets one
 * version table serve both views without a nullable column for every field of
 * both, and it is only sound while this file is the single parser.
 *
 * Two rules go with it:
 *
 *  - every Server Action that writes a slot or an override parses the payload
 *    with `slotPayloadFor(view)` **before** the insert, and stores the parsed
 *    object rather than the input — `z.object()` strips unknown keys;
 *  - every read that hands a payload to the domain parses it on the way out
 *    too. `jsonb` is `unknown` at the type level, and a cast is not a check.
 *
 * An override payload has the same shape as a slot payload of the same `view`:
 * an `EDIT` or a `SUBSTITUTION` renders as a lesson, so it carries a lesson's
 * fields.
 *
 * Keys are `camelCase` — they are TypeScript object keys, not SQL identifiers,
 * and they match `docs/architecture/glossary.md` §3 verbatim. An absent optional
 * field means the key is absent, never an empty string.
 */

export const ownSlotPayload = z.object({
  subject: z.string().min(1),
  className: z.string().min(1),
});

export const classSlotPayload = z.object({
  subject: z.string().min(1),
  teacherName: z.string().min(1),
  zoomLink: z.url().optional(),
  note: z.string().optional(),
});

export type OwnSlotPayload = z.infer<typeof ownSlotPayload>;
export type ClassSlotPayload = z.infer<typeof classSlotPayload>;
export type SlotPayload = OwnSlotPayload | ClassSlotPayload;

export function slotPayloadFor(view: ScheduleView) {
  return view === "OWN" ? ownSlotPayload : classSlotPayload;
}
