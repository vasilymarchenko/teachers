import { Check, Circle } from "lucide-react";
import type { SetupStatus } from "@/lib/db/queries/setupStatus";
import { SETUP_GATE } from "./labels";
import { setupSteps } from "./setup-steps";

/**
 * What the year-setup screen says while the rest of the app is closed —
 * overview §8.6, T-038.
 *
 * The four things `getSetupStatus()` requires, each marked as there or still
 * missing, for the year this screen is editing: that is the year whose forms
 * are below, so a line that says «бракує» is one the teacher can fill in
 * without leaving the page. The conditions themselves are not restated here —
 * `setupSteps()` gives each of the status's flags the words a teacher reads.
 *
 * A missing item is a link to the section it is entered in (T-041): the page is
 * several screens long, and a list that only says what is missing leaves the
 * teacher to find where. An item that is there is plain text — there is
 * nothing to go and do.
 */
export function SetupChecklist({
  status,
  academicYearId,
}: {
  status: SetupStatus;
  /** The year being edited, or `null` when the teacher has none yet. */
  academicYearId: string | null;
}) {
  const items = setupSteps(status, academicYearId);

  return (
    <div
      className="border-border bg-card space-y-3 rounded-lg border p-4"
      role="status"
    >
      <h2 className="text-lg font-semibold">{SETUP_GATE.title}</h2>
      <p className="text-sm">{SETUP_GATE.intro}</p>
      <ul className="space-y-1 text-sm">
        {items.map(({ key, label, done, href }) => (
          <li className="flex items-start gap-2" key={key}>
            {done ? (
              <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Circle
                aria-hidden
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
            )}
            <span>
              {done ? (
                label
              ) : (
                <a className="underline underline-offset-2" href={href}>
                  {label}
                </a>
              )}
              {" — "}
              <span className={done ? "text-muted-foreground" : "font-medium"}>
                {done ? SETUP_GATE.done : SETUP_GATE.missing}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-sm">{SETUP_GATE.optionalNote}</p>
    </div>
  );
}
