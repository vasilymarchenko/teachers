/**
 * The printed pages — specification §7, overview §2.
 *
 * A sibling of `(app)`, not a child, so it cannot inherit the navigation panel:
 * §7 requires the printed layout to carry no navigation and to be black on
 * white. This layout is only the frame; the page layout itself — sheet
 * breaks, `@media print` rules, the reports — is T-013.
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
