import Link from "next/link";
import { PARITY_VALUES, SCHEDULE_VIEW_VALUES, WEEKDAY_VALUES } from "@/lib/validation/enums";
import { cn } from "@/lib/utils";
import {
  DAY_SWITCH_LABEL,
  PARITY_OPTION_LABELS,
  PARITY_SWITCH_LABEL,
  SCHEDULE_LABELS,
  SHORT_WEEKDAY_LABELS,
  VIEW_SWITCH_LABEL,
} from "./labels";
import { templateHref, type TemplateSelection } from "./selection";

/**
 * The editor's three switches — the schedule of specification §6.2, the parity
 * week of §4 and the weekday of overview §10.2.
 *
 * Every one of them is a link to another `/schedule?…` URL, exactly like the
 * calendar's navigation: no client component, no state, and each position of
 * the editor can be bookmarked or sent to someone.
 *
 * The day switcher is `md:hidden` because it exists only for the narrow screen
 * that shows one day; the wide one shows all seven at once and has nothing to
 * switch between.
 */
export function TemplateSwitchers({
  selection,
}: {
  selection: TemplateSelection;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <nav aria-label={VIEW_SWITCH_LABEL} className="flex gap-1">
          {SCHEDULE_VIEW_VALUES.map((view) => (
            <SwitchLink
              current={view === selection.view}
              href={templateHref({ ...selection, view })}
              key={view}
            >
              {SCHEDULE_LABELS[view]}
            </SwitchLink>
          ))}
        </nav>

        <nav aria-label={PARITY_SWITCH_LABEL} className="flex gap-1">
          {PARITY_VALUES.map((parity) => (
            <SwitchLink
              current={parity === selection.parity}
              href={templateHref({ ...selection, parity })}
              key={parity}
            >
              {PARITY_OPTION_LABELS[parity]}
            </SwitchLink>
          ))}
        </nav>
      </div>

      <nav
        aria-label={DAY_SWITCH_LABEL}
        className="flex flex-wrap gap-1 md:hidden"
      >
        {WEEKDAY_VALUES.map((weekday) => (
          <SwitchLink
            current={weekday === selection.weekday}
            href={templateHref({ ...selection, weekday })}
            key={weekday}
          >
            {SHORT_WEEKDAY_LABELS[weekday]}
          </SwitchLink>
        ))}
      </nav>
    </div>
  );
}

function SwitchLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      aria-current={current ? "page" : undefined}
      className={cn(
        "border-border rounded-md border px-3 py-1.5 text-sm",
        current
          ? "bg-primary text-primary-foreground border-transparent"
          : "bg-card hover:bg-accent hover:text-accent-foreground",
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
