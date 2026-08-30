import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Honours the `@/*` alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    // The suite that matters is `lib/domain` (overview §2); everything under
    // `lib` is picked up so a test never has to be registered by hand. The
    // `components` entry is for convention tests over the source — the menu's
    // links against the real routes (T-014) — not for rendering React, which
    // would need a DOM environment this project does not carry.
    // The `.claude` entry is the same kind of convention test one level out:
    // the review rubric is a list of references (T-017), and a renumbered
    // section would rot it silently. Dot-directories are not matched by the
    // default glob, so it has to be named.
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
      ".claude/**/*.test.ts",
    ],
    // Except the integration tests: they need a migrated Postgres, and folding
    // them in would make `npm test` fail on a checkout that has not run
    // `docker compose up`. They have their own config — T-004.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    environment: "node",
  },
});
