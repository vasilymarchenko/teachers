/**
 * One block of a setup screen: a heading, a line saying what it is for, and the
 * rows.
 *
 * The year-setup page is a sequence of these, in the order specification §3
 * introduces them, so a teacher setting the year up for the first time can work
 * down the screen; the weekly template editor (T-010) reuses them so that the
 * two screens a teacher fills in read as one thing.
 */
export function Section({
  title,
  description,
  optionalMark,
  children,
}: {
  title: string;
  description: string;
  /**
   * Shown beside the heading while the year setup is incomplete, on the
   * sections the teacher may skip (overview §8.6). The word comes from the
   * caller's labels; absent, the heading is the ordinary one.
   */
  optionalMark?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {title}
          {optionalMark === undefined ? null : (
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              ({optionalMark})
            </span>
          )}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** A row's frame: one card per stored row, and one for the form that adds one. */
export function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-card rounded-lg border p-4">{children}</div>
  );
}

/** What a section says when it has no rows yet. */
export function Empty({ children }: { children: string }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}
