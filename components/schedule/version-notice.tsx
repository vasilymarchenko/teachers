import Link from "next/link";
import type { TemplateVersionRow } from "@/lib/db/queries/templateEditor";
import { addIsoDays } from "@/lib/domain/schedule/dates";
import type { IsoDate } from "@/lib/time/today";
import {
  BOUNDARY_KIND_LABELS,
  NO_BACKDATING,
  VERSION_SECTION,
} from "./labels";

/**
 * What the edit about to be made will do to the versions — invariant I2 of
 * overview §3.2, and the reason the teacher is not offered a date to edit
 * backwards from.
 *
 * The warning names **three** dates: the last day the schedule in force will
 * still cover, the day it was going to run to, and the day the new one starts —
 * the cut of I1, and the whole point of saying any of this. It is shown
 * *before* the save because that is the only moment the middle one exists —
 * once the version is trimmed, its original `validTo` is not stored anywhere
 * and cannot be named afterwards.
 *
 * The past is not hidden, it is listed: the versions that have already ended
 * are what «історія не переписується» looks like on a screen, and the line
 * about editing a past day says where that is done instead (specification §5.3).
 */
export function VersionNotice({
  versions,
  today,
}: {
  /** Every version of the view being edited, oldest first. */
  versions: readonly TemplateVersionRow[];
  today: IsoDate;
}) {
  const inForce = versions.find(
    (version) => version.validFrom <= today && today < version.validTo,
  );
  const past = versions.filter((version) => version.validTo <= today);
  const future = versions.filter((version) => version.validFrom > today);

  return (
    <div className="space-y-3">
      {inForce === undefined ? (
        <p className="text-muted-foreground text-sm">{VERSION_SECTION.none}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">
            {VERSION_SECTION.inForce(
              inForce.validFrom,
              addIsoDays(inForce.validTo, -1),
            )}{" "}
            <span className="text-muted-foreground">
              ({BOUNDARY_KIND_LABELS[inForce.boundaryKind].toLowerCase()})
            </span>
          </p>

          {inForce.validFrom === today ? (
            // Nothing to freeze: this version has never been in force on a day
            // that has passed, so an edit today goes into it (schema §4.7).
            <p className="text-muted-foreground text-sm">
              {VERSION_SECTION.sameDay}
            </p>
          ) : (
            <p className="border-border bg-muted/40 rounded-md border p-3 text-sm">
              {VERSION_SECTION.cutWarning(
                today,
                addIsoDays(today, -1),
                addIsoDays(inForce.validTo, -1),
              )}
            </p>
          )}
        </div>
      )}

      {past.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{VERSION_SECTION.historyTitle}</h3>
          <ul className="text-muted-foreground space-y-0.5 text-sm">
            {past.map((version) => (
              <li key={version.id}>
                {VERSION_SECTION.historyRow(
                  version.validFrom,
                  addIsoDays(version.validTo, -1),
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {future.length > 0 ? (
        <div className="space-y-1">
          {future.map((version) => (
            <p className="text-muted-foreground text-sm" key={version.id}>
              {`${VERSION_SECTION.historyRow(version.validFrom, addIsoDays(version.validTo, -1))} — ${VERSION_SECTION.future}`}
            </p>
          ))}
          <p className="text-sm">
            {VERSION_SECTION.cappedBy(future[0].validFrom)}
          </p>
        </div>
      ) : null}

      <p className="text-muted-foreground text-sm">
        {NO_BACKDATING.text}{" "}
        <Link className="underline underline-offset-2" href="/calendar">
          {NO_BACKDATING.link}
        </Link>
      </p>
    </div>
  );
}
