import { redirect } from "next/navigation";
import { calendarHref, scheduleViewOf } from "@/components/calendar/links";
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
  searchParams: Promise<{ schedule?: string }>;
}) {
  const { schedule } = await searchParams;
  // `today()` and not `new Date()`: the container runs in UTC and Kyiv is
  // three hours ahead of it at night (overview §8.5).
  redirect(calendarHref("day", today(), scheduleViewOf(schedule)));
}
