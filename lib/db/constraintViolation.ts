/**
 * Reading a constraint violation off a database error, so a Server Action can
 * answer it as a message instead of a 500.
 *
 * Several rules of the year frame are enforced only by the database, and
 * deliberately so: whether two academic years overlap
 * (`academic_year_no_overlap_ex`) or whether the year already has a first
 * semester (`semester_year_index_uq`) cannot be decided by a form schema, and
 * checking them in the action before writing would be a race — two submissions
 * can both read "no overlap" and then both insert. So the write is attempted,
 * and the violation is the answer (schema §4.1, §4.2).
 *
 * The class of error is what this module identifies; the wording is the
 * caller's, because only the caller knows which form the teacher is looking at.
 *
 * It is deliberately duck-typed rather than an `instanceof PostgresError`:
 * `postgres` builds that class per import, and a mismatched module instance
 * would turn every constraint into a 500. What it looks for is a `code` in
 * PostgreSQL's integrity-violation class 23 plus a constraint name, which is
 * what the protocol actually sends.
 */

/** PostgreSQL class 23 — the codes a form submission can legitimately produce. */
const INTEGRITY_VIOLATION_CODES = new Set([
  "23505", // unique_violation
  "23514", // check_violation
  "23P01", // exclusion_violation
  "23503", // foreign_key_violation
]);

/** How far down a `cause` chain to look, if a driver ever wraps its errors. */
const MAX_CAUSE_DEPTH = 4;

/**
 * The name of the violated constraint, or `undefined` when the error is not an
 * integrity violation — a connection failure, a bug, anything the teacher can
 * do nothing about. `undefined` means *rethrow*: an error nobody phrased for
 * her belongs in the logs and on the error page, not on the form as a shrug.
 */
export function violatedConstraint(error: unknown): string | undefined {
  for (let depth = 0, current = error; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null) return undefined;

    const { code, constraint_name: constraint } = current as {
      code?: unknown;
      constraint_name?: unknown;
    };

    if (
      typeof code === "string" &&
      INTEGRITY_VIOLATION_CODES.has(code) &&
      typeof constraint === "string" &&
      constraint !== ""
    ) {
      return constraint;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return undefined;
}

/**
 * The message for a violation, or `undefined` when the error is not one.
 *
 * `fallback` covers an integrity violation the caller has no wording for. It is
 * a message and not a rethrow on purpose: class 23 means the *data* was
 * refused, so the teacher can act on it, and telling her the save did not go
 * through beats an error page. The fallback comes from the caller so that the
 * Ukrainian stays with the screen it belongs to.
 */
export function constraintMessage(
  error: unknown,
  messages: Readonly<Record<string, string>>,
  fallback: string,
): string | undefined {
  const constraint = violatedConstraint(error);
  if (constraint === undefined) return undefined;
  return messages[constraint] ?? fallback;
}
