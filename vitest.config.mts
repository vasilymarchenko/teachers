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
    // `scripts/**` is here for the gate's own convention tests (T-029): the
    // gate is what runs `npm test`, so the test holding its check list in step
    // with `ci.yml` has to run in the same suite the gate runs.
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    // Except the integration tests: they need a migrated Postgres, and folding
    // them in would make `npm test` fail on a checkout that has not run
    // `docker compose up`. They have their own config — T-004.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    environment: "node",
  },
});
