import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Honours the `@/*` alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    // The suite that matters is `lib/domain` (overview §2); everything under
    // `lib` is picked up so a test never has to be registered by hand.
    include: ["lib/**/*.test.ts"],
    // Except the integration tests: they need a migrated Postgres, and folding
    // them in would make `npm test` fail on a checkout that has not run
    // `docker compose up`. They have their own config — T-004.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    environment: "node",
  },
});
