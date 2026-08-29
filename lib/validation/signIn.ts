import { z } from "zod";

/**
 * The sign-in form's input — the boundary between the browser and
 * `signInAction`.
 *
 * Messages are Ukrainian: a teacher reads them (root `CLAUDE.md`, language by
 * audience). They describe the shape of the input only. What a wrong password
 * produces is decided by better-auth and phrased in `lib/actions/auth.ts`,
 * deliberately without saying which of the two fields was wrong.
 */
export const signInInput = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Введіть електронну пошту")
    .email("Введіть коректну електронну пошту"),
  password: z.string().min(1, "Введіть пароль"),
});

export type SignInInput = z.infer<typeof signInInput>;
