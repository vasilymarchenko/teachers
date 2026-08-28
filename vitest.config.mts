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
    environment: "node",
  },
});
