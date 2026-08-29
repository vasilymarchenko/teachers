/**
 * The printed pages — specification §7, overview §2.
 *
 * A sibling of `(app)`, not a child, so it cannot inherit the navigation panel:
 * §7 requires the printed layout to carry no navigation and to be black on
 * white. This layout is only the frame; the page layout itself — sheet
 * breaks, `@media print` rules, the reports — is T-013.
 *
 * The literal black and white are deliberate, and the one place in the
 * application that does not take its colours from the theme tokens: §7 asks for
 * a printed page that is black on white, which is a property of paper rather
 * than a style choice. Restyling the application must not tint what comes out
 * of the printer, so these two do not follow `--background` / `--foreground`.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-full flex-1 bg-white p-6 text-black">{children}</main>
  );
}
