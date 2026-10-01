import { redirect } from "next/navigation";
import { YEAR_SETUP_PATH } from "@/lib/actions/yearSetup";
import { getSetupStatus } from "@/lib/db/queries/setupStatus";
import { requireUser, type SessionUser } from "./session";

/**
 * The year-setup gate — overview §8.6, T-038.
 *
 * What every page of the `(app)` group except year setup calls instead of
 * `requireUser()`: the same boundary first (overview §8.3), then the question
 * of whether there is a year frame to read at all. A teacher whose setup is
 * incomplete is sent to year setup, because no other screen means anything
 * before it — and the calendar does not merely look empty without it, it
 * throws.
 *
 * It is called by the page and not by the `(app)` layout: a layout is not
 * rendered again on a navigation between its pages, so a check that lived
 * there would be skipped by exactly the clicks it exists for (`ADR-018`).
 * `setupGate.integration.test.ts` walks `app/(app)` and fails for a page that
 * forgets the call.
 *
 * `redirect()` throws, so control never returns without a complete setup.
 */
export async function requireCompleteSetup(): Promise<SessionUser> {
  const user = await requireUser();
  const status = await getSetupStatus(user.id);
  if (!status.complete) redirect(YEAR_SETUP_PATH);
  return user;
}
