/**
 * The `(auth)` route group of overview §2.
 *
 * Deliberately bare: sign-in has no navigation to show, and the application
 * chrome is T-014's. This layout exists so the group is real and so the form is
 * centred on a phone as well as on a laptop.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
