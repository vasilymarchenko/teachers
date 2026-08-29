"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { getAuth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/auth/session";
import { isBadCredentials } from "@/lib/auth/signInError";
import { signInInput } from "@/lib/validation/signIn";

/**
 * What the sign-in form renders after a submission. `undefined` fields mean
 * "nothing to report"; a successful sign-in never produces a state at all,
 * because the action redirects.
 */
export type SignInState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  /**
   * The address that was submitted, echoed back so the form can restore it.
   * React resets an uncontrolled input once the action resolves, and making a
   * teacher retype their address after mistyping their password is a bad way
   * to run the one screen they cannot get past. The password is deliberately
   * not echoed.
   */
  email?: string;
};

/**
 * The one Server Action that does not begin with `requireUser()` — it is what
 * creates the session the others require. Everything else about the shape of
 * overview §2 holds: Zod first, then the call that touches data, then a
 * navigation.
 *
 * The error message names neither field on purpose: telling a visitor that the
 * address exists but the password is wrong is an account-enumeration oracle.
 */
export async function signInAction(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const submittedEmail = String(formData.get("email") ?? "");
  const parsed = signInInput.safeParse({
    email: submittedEmail,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      email: submittedEmail,
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  try {
    await getAuth().api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError && isBadCredentials(error)) {
      return {
        email: parsed.data.email,
        error: "Неправильна електронна пошта або пароль",
      };
    }
    // Anything else — an unset BETTER_AUTH_SECRET, an unreachable database, a
    // session that could not be created — is a fault, not a wrong password.
    // Rethrowing puts it in the logs and on the error page instead of telling
    // the teacher to retype a password that was right all along.
    throw error;
  }

  // Outside the `try`: `redirect()` signals by throwing, and a `catch` around
  // it would swallow the navigation.
  redirect("/");
}

/**
 * `requireUser()` → mutation → navigation, the shape of overview §2.
 *
 * `requireUser()` is not decoration here: it is what makes signing out a no-op
 * for a request that carries no session, rather than an unauthenticated call
 * into better-auth.
 */
export async function signOutAction(): Promise<void> {
  await requireUser();
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
