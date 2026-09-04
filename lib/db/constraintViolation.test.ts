import { describe, expect, it } from "vitest";
import { constraintMessage, violatedConstraint } from "./constraintViolation";

/**
 * The error shape `postgres` produces, as the year-setup actions read it.
 *
 * The fields are the ones the PostgreSQL protocol sends and the driver copies
 * onto its error (`node_modules/postgres/src/connection.js` maps field `n` to
 * `constraint_name`); the tests are built from that shape rather than from a
 * live database, which is what keeps them in the unit suite.
 */

const postgresError = (fields: Record<string, unknown>) =>
  Object.assign(new Error("duplicate key value violates unique constraint"), {
    name: "PostgresError",
    severity: "ERROR",
    ...fields,
  });

describe("violatedConstraint()", () => {
  it("names the constraint of an exclusion violation", () => {
    // Two academic years of one teacher overlapping (schema §4.1).
    const error = postgresError({
      code: "23P01",
      constraint_name: "academic_year_no_overlap_ex",
    });

    expect(violatedConstraint(error)).toBe("academic_year_no_overlap_ex");
  });

  it("names the constraint of a unique violation", () => {
    const error = postgresError({
      code: "23505",
      constraint_name: "semester_year_index_uq",
    });

    expect(violatedConstraint(error)).toBe("semester_year_index_uq");
  });

  it("names the constraint of a check violation", () => {
    const error = postgresError({
      code: "23514",
      constraint_name: "bell_schedule_times_ck",
    });

    expect(violatedConstraint(error)).toBe("bell_schedule_times_ck");
  });

  it("ignores an error that is not an integrity violation", () => {
    // A connection failure is not something the teacher mistyped.
    expect(violatedConstraint(postgresError({ code: "08006" }))).toBeUndefined();
    expect(violatedConstraint(new Error("boom"))).toBeUndefined();
    expect(violatedConstraint(undefined)).toBeUndefined();
    expect(violatedConstraint("23505")).toBeUndefined();
  });

  it("ignores an integrity violation with no constraint name", () => {
    // 23502 (not_null_violation) reports a column, not a constraint; there is
    // nothing to map it to.
    expect(
      violatedConstraint(postgresError({ code: "23502", column_name: "name" })),
    ).toBeUndefined();
  });

  it("looks through a wrapped error", () => {
    // The driver does not wrap today; a future Drizzle release that does must
    // not silently turn every constraint into a 500.
    const wrapped = Object.assign(new Error("Failed query"), {
      cause: postgresError({
        code: "23P01",
        constraint_name: "semester_no_overlap_ex",
      }),
    });

    expect(violatedConstraint(wrapped)).toBe("semester_no_overlap_ex");
  });

  it("does not follow a cause chain forever", () => {
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;

    expect(violatedConstraint(cyclic)).toBeUndefined();
  });
});

describe("constraintMessage()", () => {
  const messages = { academic_year_no_overlap_ex: "Ці дати перетинаються з іншим роком" };
  const fallback = "Не вдалося зберегти";

  it("returns the caller's message for a constraint it knows", () => {
    const error = postgresError({
      code: "23P01",
      constraint_name: "academic_year_no_overlap_ex",
    });

    expect(constraintMessage(error, messages, fallback)).toBe(
      "Ці дати перетинаються з іншим роком",
    );
  });

  it("falls back for an integrity violation it has no wording for", () => {
    const error = postgresError({ code: "23505", constraint_name: "something_uq" });

    expect(constraintMessage(error, messages, fallback)).toBe(fallback);
  });

  it("returns undefined for anything else, which the caller rethrows", () => {
    expect(constraintMessage(new Error("boom"), messages, fallback)).toBeUndefined();
  });
});
