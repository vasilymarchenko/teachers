"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

/**
 * The menu itself.
 *
 * A client component for one reason: marking the current screen needs the
 * pathname, and there is no server-side equivalent. Without JavaScript the
 * links still navigate — only the highlight is missing.
 *
 * `onNavigate` fires on every activated link, including the one for the screen
 * already open. The mobile disclosure needs that: a re-tap of the current item
 * changes no pathname, so an effect watching the pathname never sees it.
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1">
      {navItems.map(({ label, href, icon: Icon }) => {
        // `/calendar/2026-09-01` is still the calendar, so match the prefix —
        // but on a segment boundary, or `/year` would also light up `/yearbook`.
        const isCurrent = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-base transition-colors",
                "focus-visible:ring-sidebar-ring/60 outline-none focus-visible:ring-2",
                isCurrent
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  "size-5 shrink-0",
                  isCurrent ? "text-sidebar-primary" : "text-sidebar-foreground/60",
                )}
              />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
