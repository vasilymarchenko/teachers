import type { Parity } from "@/lib/db/schema/enums";
import type { IsoDate } from "@/lib/time/today";
import { isoWeeksBetween } from "./dates";
import type { ParityAnchorInput } from "./types";

/**
 * Week parity on a date — overview §3.5.
 *
 * ```
 * parity(d) = anchor.parity XOR ( weeksBetween( startOfISOWeek(anchor.date),
 *                                               startOfISOWeek(d) ) % 2 )
 * where anchor = the last ParityAnchor with date <= d
 * ```
 *
 * Weeks are ISO, Monday-start. Parity is a property of the date and is computed
 * for non-teaching dates too (glossary §2).
 *
 * **The Q-001 default lives here and nowhere else.** The counter runs over
 * calendar weeks, so a week with no teaching in it — a full break week — still
 * consumes a parity position: `2026-W44` is entirely non-teaching and the week
 * after it is `DENOMINATOR` all the same (fixtures §8.2). Answering Q-001 the
 * other way is a change to this function and its tests: no migration, no stored
 * row and no other module moves.
 */

const OTHER: Record<Parity, Parity> = {
  NUMERATOR: "DENOMINATOR",
  DENOMINATOR: "NUMERATOR",
};

/**
 * The anchor in force on `date`: the last one with `date <= d`.
 *
 * Before the earliest anchor there is none in force, and the earliest one is
 * used instead — the alternation simply extends backwards. That keeps the
 * function total for a teacher who opens August before the year's first anchor,
 * rather than leaving `ResolvedDay.parity` undefined for those dates.
 */
function anchorInForce(
  date: IsoDate,
  anchors: readonly ParityAnchorInput[],
): ParityAnchorInput {
  let inForce: ParityAnchorInput | undefined;
  let earliest: ParityAnchorInput | undefined;

  for (const anchor of anchors) {
    if (earliest === undefined || anchor.date < earliest.date) {
      earliest = anchor;
    }
    if (
      anchor.date <= date &&
      (inForce === undefined || anchor.date > inForce.date)
    ) {
      inForce = anchor;
    }
  }

  const anchor = inForce ?? earliest;
  if (anchor === undefined) {
    // The year's initial parity is itself a ParityAnchor (overview §3.5), so an
    // empty list is a broken year setup, not a date the teacher can navigate to.
    throw new Error("parityOn: no ParityAnchor — the academic year has none");
  }
  return anchor;
}

/** The parity of the ISO week `date` falls in. */
export function parityOn(
  date: IsoDate,
  anchors: readonly ParityAnchorInput[],
): Parity {
  const anchor = anchorInForce(date, anchors);
  // `%` keeps the sign of the dividend, and the difference is negative for a
  // date before the anchor; only "same week parity or not" is being asked.
  const flipped = Math.abs(isoWeeksBetween(anchor.date, date) % 2) === 1;
  return flipped ? OTHER[anchor.parity] : anchor.parity;
}
