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
  id,
  title,
  description,
  optionalMark,
  children,
}: {
  /**
   * The fragment a link jumps to — set on the sections the year-setup
   * checklist points at (`SETUP_ANCHORS`, T-041).
   */
  id?: string;
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
    // `scroll-mt-4`: a jump to the fragment leaves the heading a little room
    // rather than flush against the top edge of the screen.
    <section className="scroll-mt-4 space-y-4" id={id}>
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

/**
 * The sentence an edit form shows beside its boundary when the symbol stored
 * there now resolves to another date — overview §8.1, T-047. The page decides
 * it on the server, so it is there with JavaScript off; the words are the
 * caller's.
 */
export function RestatedBoundary({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground border-border border-l-2 pl-3 text-sm">
      {children}
    </p>
  );
}

/** What a section says when it has no rows yet. */
export function Empty({ children }: { children: string }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}
