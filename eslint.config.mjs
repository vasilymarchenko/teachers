import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The fast half of the `userId` discipline (overview §8.4): these two
    // shapes are the ones worth catching in the editor rather than in CI. The
    // rule as a whole is enforced by `lib/auth/queryDiscipline.test.ts`, which
    // also checks what a selector cannot — that a query's *first* parameter is
    // the one named `userId`.
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='get'][arguments.0.value='userId']",
          message:
            "userId never comes from request input. Take it from requireUser() — architect-overview.md §8.4.",
        },
        {
          selector:
            "CallExpression[callee.property.name='object'] > ObjectExpression > Property[key.name='userId']",
          message:
            "A Zod schema must not declare userId; validating it does not make it trusted — architect-overview.md §8.4.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
