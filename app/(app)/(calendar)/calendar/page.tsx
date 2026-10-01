import { redirect } from "next/navigation";
import {
  calendarHref,
  scheduleViewOf,
  type SearchParamValue,
} from "@/components/calendar/links";
import { requireCompleteSetup } from "@/lib/auth/setupGate";
import { today } from "@/lib/time/today";

/**
 * `/calendar` — the menu item — opens today (specification §6, the calendar is
 * the main screen).
 *
 * The screen itself lives at `/calendar/<view>/<date>`, so this only chooses
 * where «today» is: the day view, which is the one that fits a phone without a
 * single decision from the teacher (overview §10.2).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ schedule?: SearchParamValue }>;
}) {
  // The boundary and the year-setup gate first (overview §8.3, §8.6): this
  // page reads nothing of its own, but a teacher with no year yet goes to year
  // setup from here rather than by way of a calendar date.
  await requireCompleteSetup();

  const { schedule } = await searchParams;
  // `today()` and not `new Date()`: the container runs in UTC and Kyiv is
  // three hours ahead of it at night (overview §8.5).
  redirect(calendarHref("day", today(), scheduleViewOf(schedule)));
}
