import { redirect } from "next/navigation";

/**
 * The calendar is the main screen (specification §6), so the root path opens
 * it. `/calendar` is inside the `(app)` group, so `requireUser()` runs there —
 * this redirect deliberately reads nothing itself.
 */
export default function HomePage() {
  redirect("/calendar");
}
