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
 * completion notice — but only if setup was incomplete at some point of this
 * visit to the screen, so it is a save the teacher made here that completed
 * it. That includes a visit that began complete, lost a condition to a
 * deletion and regained it. A teacher who opens `/year` with setup complete
 * and leaves it so is on the ordinary year-setup screen and is told nothing.
 */
export function progressNotice({
  complete,
  seenIncomplete,
  hasNext,
}: {
  complete: boolean;
  /** Setup was incomplete at mount or at any render since. */
  seenIncomplete: boolean;
  hasNext: boolean;
}): ProgressNotice {
  if (!complete) return hasNext ? "next" : null;
  return seenIncomplete ? "complete" : null;
}

/**
 * Whether setup has been incomplete during this visit, after one more render
 * with `complete`. Once true it stays true until the screen is left.
 */
export function seenIncompleteAfter(seen: boolean, complete: boolean): boolean {
  return seen || !complete;
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
 * Whether setup has been incomplete during this visit is remembered in state
 * rather than read from anything: a save revalidates `/year` and re-renders the
 * page around this component without remounting it, so the state survives
 * exactly as long as the visit does. The page renders it as its last child,
 * unconditionally, for that reason — moved or wrapped in a condition, it would
 * be remounted by the save that completes setup and would forget it was ever
 * incomplete. Leaving the screen, or opening it again, starts from the
 * ordinary screen.
 */
export function SetupProgress({
  complete,
  next,
}: {
  complete: boolean;
  /** The first missing item, as `nextSetupStep()` gives it; `null` when none. */
  next: { label: string; href: string } | null;
}) {
  const [seenIncomplete, setSeenIncomplete] = useState(!complete);
  // Set during render, the way React adjusts state to a prop that changed: a
  // deletion that reopens setup is a re-render with `complete` false, and an
  // effect would record it one commit late for no gain.
  const seen = seenIncompleteAfter(seenIncomplete, complete);
  if (seen !== seenIncomplete) setSeenIncomplete(seen);
  const notice = progressNotice({
    complete,
    seenIncomplete,
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
