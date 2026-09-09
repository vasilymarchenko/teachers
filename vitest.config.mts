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
    // would need a DOM environment this project does not carry. The `scripts`
    // entry is the gate's own tests (T-026): the check table has to stay in
    // step with `ci.yml`, and a test that says so is only worth having if
    // `npm test` — which is itself one of the gate's checks — runs it.
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
