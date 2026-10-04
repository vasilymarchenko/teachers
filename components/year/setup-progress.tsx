"use client";

import { ArrowDown, ArrowRight, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PAGE_LABELS, SETUP_PROGRESS } from "./labels";

/** What the bar has to say, or `null` for the ordinary screen. */
export type ProgressNotice = "next" | "complete" | null;

/**
 * Which notice the bar shows — overview §8.6, T-041.
 *
 * While setup is incomplete, the next missing item. Once it is complete, the
 * completion notice — but only on the render that the completing save
 * produced (`completedHere`). Every later render of the page is the ordinary
 * screen: opening `/year` again, from the menu or the year switcher, and any
 * further save alike.
 */
export function progressNotice({
  complete,
  completedHere,
  hasNext,
}: {
  complete: boolean;
  /** This render is the one in which setup turned complete. */
  completedHere: boolean;
  hasNext: boolean;
}): ProgressNotice {
  if (!complete) return hasNext ? "next" : null;
  return completedHere ? "complete" : null;
}

/** What the bar remembers between the renders of one mount. */
export type ProgressMemory = {
  /** `complete` as of the last render seen. */
  complete: boolean;
  /** The `renderId` of the render in which setup turned complete, if any. */
  completedIn: string | null;
};

/**
 * The memory after one more render.
 *
 * A render that finds setup complete where the previous one found it
 * incomplete is the completing save's, and its id is kept; anything else
 * leaves the memory as it was, or forgets that id once setup is incomplete
 * again. The same object comes back when nothing changed, so the component
 * can tell whether to store it.
 */
export function rememberRender(
  memory: ProgressMemory,
  { complete, renderId }: { complete: boolean; renderId: string },
): ProgressMemory {
  if (complete === memory.complete) return memory;
  return { complete, completedIn: complete ? renderId : null };
}

/**
 * The bar at the bottom of the year-setup screen — overview §8.6, T-041.
 *
 * Stuck to the bottom of the viewport, so it is in view of whichever button was
 * pressed, wherever on a page several screens long that button is — and on a
 * phone, where the navigation is collapsed, it is page content rather than a
 * menu item, so the teacher learns the rest of the app is open without opening
 * the menu.
 *
 * Which render completed setup is remembered in state: a save revalidates
 * `/year` and re-renders the page around this component without remounting it,
 * which is what lets it compare one render with the next. The page renders it
 * as its last child, unconditionally, for that reason — moved or wrapped in a
 * condition, it would be remounted by the completing save and would have
 * nothing to compare with.
 *
 * The same holds for a navigation that stays on `/year` — the menu's link to
 * the screen already open, the year switcher: the router keys the page without
 * its search parameters and does not remount it (review of PR #50). So the
 * state cannot say whether the screen was opened again; `renderId` does. The
 * page draws a new one on every server render, so the completion notice is
 * shown on the completing save's render and on no later one.
 */
export function SetupProgress({
  complete,
  next,
  renderId,
}: {
  complete: boolean;
  /** The first missing item, as `nextSetupStep()` gives it; `null` when none. */
  next: { label: string; href: string } | null;
  /** Unique to the server render this came from. */
  renderId: string;
}) {
  const [memory, setMemory] = useState<ProgressMemory>({
    complete,
    completedIn: null,
  });
  // Set during render, the way React adjusts state to a prop that changed: an
  // effect would record the completing render one commit late, after the
  // screen had already been drawn without its notice.
  const remembered = rememberRender(memory, { complete, renderId });
  if (remembered !== memory) setMemory(remembered);
  const notice = progressNotice({
    complete,
    completedHere: remembered.completedIn === renderId,
    hasNext: next !== null,
  });

  return (
    <div aria-live="polite" className="sticky bottom-4 z-10" role="status">
      {notice === "next" && next !== null ? <NextStepNotice next={next} /> : null}
      {notice === "complete" ? <CompletionNotice /> : null}
    </div>
  );
}

const card = "border-border bg-card rounded-lg border p-4 shadow-lg";

function NextStepNotice({ next }: { next: { label: string; href: string } }) {
  return (
    <div className={`${card} flex flex-wrap items-center gap-x-4 gap-y-2`}>
      <p className="min-w-0 flex-1 text-sm">
        <span className="text-muted-foreground">{SETUP_PROGRESS.next}</span>{" "}
        <span className="font-medium">{next.label}</span>
      </p>
      <Button asChild size="sm" variant="outline">
        <a href={next.href}>
          {SETUP_PROGRESS.goTo}
          <ArrowDown aria-hidden />
        </a>
      </Button>
    </div>
  );
}

/**
 * What the save that completes setup is answered with. The weekly template is
 * the action, not the calendar: the calendar shows nothing until the template
 * has lessons in it (overview §8.6).
 */
export function CompletionNotice() {
  return (
    <div className={`${card} space-y-3`}>
      <div className="flex items-start gap-3">
        <PartyPopper aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <h2 className="font-semibold">{SETUP_PROGRESS.completeTitle}</h2>
          <p className="text-sm">{SETUP_PROGRESS.completeText}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button asChild size="lg">
          <Link href="/schedule">
            {SETUP_PROGRESS.toSchedule}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Link className="text-sm underline underline-offset-2" href="/calendar">
          {PAGE_LABELS.toCalendar}
        </Link>
      </div>
    </div>
  );
}
