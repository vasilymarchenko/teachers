import { today, type IsoDate } from "@/lib/time/today";

/**
 * Copy-on-write for a `ScheduleTemplate` version — overview §3.2, invariants I1
 * and I2. Pure planning: this decides which rows change, the Server Action
 * (T-010) writes them.
 *
 * **The cut is always `today()`.** It is read here, from `lib/time/today.ts`,
 * and never taken from the caller: an edit whose cut date came from a form is
 * exactly the retroactive edit I1 forbids — the way to change a day that has
 * already passed is a `DayOverride` (specification §5.3). `now` below is an
 * *instant*, the same parameter `today()` itself takes, so a test can pin the
 * clock without being able to pin the date.
 */

/** The interval half of a `schedule_template` row. */
export type TemplateVersionRange = {
  id: string;
  validFrom: IsoDate;
  /** Exclusive. */
  validTo: IsoDate;
};

export type TemplateEditPlan = {
  /** `today()` in `Europe/Kyiv`. */
  cutAt: IsoDate;
  /** I2: the version in force ends at the cut, freezing the past it covered. */
  trim?: { id: string; validTo: IsoDate };
  /**
   * The version in force started today, so it has no past to freeze and is
   * replaced outright. Trimming it would leave `[d, d)`, which the
   * `schedule_template_range_ck` check rejects.
   */
  replace?: { id: string };
  create: { validFrom: IsoDate; validTo: IsoDate };
};

export type TemplateEditRequest = {
  /**
   * The version in force on the cut date, if there is one: `validFrom <= cutAt
   * < validTo`. A version that ends at or before the cut is a gap — pass none.
   */
  current?: TemplateVersionRange;
  /** The new version's exclusive bound, from `resolveBoundary()`. */
  validTo: IsoDate;
  /** An instant, for tests. Never a date. */
  now?: Date;
};

/**
 * What the edit does to the stored rows.
 *
 * Out of scope by design: versions that begin **after** the cut date. This plans
 * the edit against the one version in force; the editor decides what to do with
 * a future version it would overlap, and invariant I3 — the `EXCLUDE USING gist`
 * constraint — is the backstop that stops a wrong answer reaching the database.
 */
export function planTemplateEdit({
  current,
  validTo,
  now,
}: TemplateEditRequest): TemplateEditPlan {
  const cutAt = today(now);

  if (validTo <= cutAt) {
    throw new Error(
      `planTemplateEdit: validTo ${validTo} is not after the cut ${cutAt}`,
    );
  }
  if (current !== undefined && current.validFrom > cutAt) {
    throw new Error(
      `planTemplateEdit: version ${current.id} begins after the cut ${cutAt}`,
    );
  }
  if (current !== undefined && current.validTo <= cutAt) {
    // Trimming it would move `validTo` *forward* to the cut and close a gap the
    // teacher's earlier edit opened on purpose (fixtures §3.8, 2026-11-02): a
    // version that has already ended is a gap, and the caller must pass none.
    throw new Error(
      `planTemplateEdit: version ${current.id} ended before the cut ${cutAt}`,
    );
  }

  const create = { validFrom: cutAt, validTo };

  if (current === undefined) {
    // A gap, or the first version of this view: nothing to freeze (§3.2).
    return { cutAt, create };
  }
  if (current.validFrom === cutAt) {
    return { cutAt, replace: { id: current.id }, create };
  }
  return { cutAt, trim: { id: current.id, validTo: cutAt }, create };
}
