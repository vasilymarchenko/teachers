import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The Postgres version is named in three files, and they have to agree.
 *
 * `docker-compose.yml` is what a developer runs, `docker-compose.prod.yml` is
 * what the VPS runs, and `.github/workflows/ci.yml` is what the gate runs the
 * integration suite and the migrator smoke test against (T-024). A skew between
 * them means CI proves something about a database nobody deploys — and the
 * exclusion constraints of `design/schema.md` §4.7 are exactly the kind of
 * feature whose behaviour is a property of the server version.
 *
 * This is the cheaper of the two shapes the ticket weighed: no file becomes the
 * source the others generate from, they simply have to match, and a check says
 * so. Same shape as `lib/auth/queryDiscipline.test.ts` — a convention, enforced
 * rather than agreed.
 */

const FILES = [
  "docker-compose.yml",
  "docker-compose.prod.yml",
  ".github/workflows/ci.yml",
];

/**
 * Every `postgres:<tag>` image reference in a file.
 *
 * Deliberately textual: these are three different formats — two Compose files
 * and a workflow — and the one thing they share is the image string. Matching
 * `postgres:` followed by a digit keeps it off `POSTGRES_USER`, off the
 * `postgres://` URLs that appear in all three, and off a comment saying the
 * word.
 */
export function postgresImagesIn(source: string): string[] {
  return [...source.matchAll(/\bpostgres:\d[\w.-]*/g)].map(([match]) => match);
}

describe("the Postgres image", () => {
  const found = FILES.map((file) => ({
    file,
    images: postgresImagesIn(readFileSync(file, "utf8")),
  }));

  for (const { file, images } of found) {
    it(`is named in ${file}`, () => {
      // Guards against a renamed or moved file turning the agreement check
      // below into a comparison of two empty lists, which trivially passes.
      expect(images.length).toBeGreaterThan(0);
    });
  }

  it("is the same everywhere it is named", () => {
    const distinct = [...new Set(found.flatMap(({ images }) => images))];

    expect(
      distinct.length === 1
        ? []
        : found.map(({ file, images }) => `${file}: ${images.join(", ")}`),
    ).toEqual([]);
  });
});

describe("the check itself", () => {
  it("finds an image reference in each of the three formats", () => {
    expect(postgresImagesIn("    image: postgres:16-alpine\n")).toEqual([
      "postgres:16-alpine",
    ]);
    expect(postgresImagesIn("  POSTGRES_IMAGE: postgres:17\n")).toEqual([
      "postgres:17",
    ]);
  });

  it("ignores the things that merely look like one", () => {
    // Without this the check would report a skew between `postgres:16-alpine`
    // and the connection strings sitting three lines below it — or, worse,
    // match nothing at all and pass on a file it never really read.
    expect(
      postgresImagesIn(
        "DATABASE_URL: postgres://teachers:teachers@127.0.0.1:5432/teachers\n" +
          "POSTGRES_USER: teachers\n" +
          "# postgres: the database this project uses\n",
      ),
    ).toEqual([]);
  });

  it("reports a skew rather than the first value it saw", () => {
    const images = postgresImagesIn(
      "image: postgres:16-alpine\nimage: postgres:17-alpine\n",
    );

    expect(new Set(images).size).toBe(2);
  });
});
