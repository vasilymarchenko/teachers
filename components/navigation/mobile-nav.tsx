"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { NavLinks } from "./nav-links";

/**
 * The navigation panel at phone width — specification §1 (a fully usable phone
 * version) and overview §10.2.
 *
 * A `<details>` disclosure rather than a scripted drawer: it opens and closes
 * with no JavaScript and needs no dialog dependency. The one thing script adds
 * is closing it after a navigation — client routing keeps the element mounted,
 * so without this the menu would stay open over the screen it just opened.
 *
 * Closing is driven from both ends because neither covers the other: the
 * pathname effect catches a navigation that did not start here (a link inside
 * the page, the back button), and the link callback catches a tap on the screen
 * already open, which changes no pathname at all.
 */
export function MobileNav({ footer }: { footer: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);

  const close = useCallback(() => {
    if (ref.current) ref.current.open = false;
  }, []);

  useEffect(close, [pathname, close]);

  return (
    <details
      ref={ref}
      className="bg-sidebar text-sidebar-foreground border-sidebar-border border-b md:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
        <Menu aria-hidden className="size-6 shrink-0" />
        Меню
      </summary>
      <div className="flex flex-col gap-4 px-3 pb-4">
        <nav aria-label="Головне меню">
          <NavLinks onNavigate={close} />
        </nav>
        {footer}
      </div>
    </details>
  );
}
