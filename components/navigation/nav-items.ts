import {
  CalendarDays,
  CalendarRange,
  ListChecks,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { YEAR_SETUP_PATH } from "@/lib/actions/yearSetup";

export type NavItem = {
  /** The menu label, as the teacher reads it. */
  label: string;
  /** The route it opens. Checked against the real routes in the test. */
  href: string;
  icon: LucideIcon;
};

/**
 * The navigation menu — the single place it is defined.
 *
 * One item per screen of the first release, each named for the section of the
 * specification it serves: Календар (§6, the main screen), Розклад (§5, the
 * weekly template), Події (§6.3) and Навчальний рік (§3 — boundaries, bells,
 * parity). The labels follow `docs/architecture/glossary.md` where it names the
 * term; they are screen names, not entity names.
 *
 * Specification §8 excludes two items that appear on the mockups —
 * «Календарне планування» and «Розробка уроку». They are absent here, and
 * `nav-items.test.ts` fails if either comes back.
 */
export const navItems: readonly NavItem[] = [
  { label: "Календар", href: "/calendar", icon: CalendarDays },
  { label: "Розклад", href: "/schedule", icon: Table2 },
  { label: "Події", href: "/events", icon: ListChecks },
  { label: "Навчальний рік", href: YEAR_SETUP_PATH, icon: CalendarRange },
];

/**
 * The menu a teacher is offered — overview §8.6.
 *
 * While the year setup is incomplete every screen but year setup redirects to
 * it, so the menu carries that one item: a link that only bounces back is not
 * a link worth showing. Sign-out is not a menu item and stays in the panel's
 * footer either way.
 */
export function navItemsFor(setupComplete: boolean): readonly NavItem[] {
  return setupComplete
    ? navItems
    : navItems.filter((item) => item.href === YEAR_SETUP_PATH);
}

/** Menu items of the mockups that the first release does not carry (§8). */
export const excludedNavLabels: readonly string[] = [
  "Календарне планування",
  "Розробка уроку",
];
