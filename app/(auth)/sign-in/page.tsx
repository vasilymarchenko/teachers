import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { SignInForm } from "./sign-in-form";

// The session is read per request; nothing here may be frozen into the build.
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  // A teacher who is already signed in has no business on this page. This is
  // the one screen that reads the session without requiring it.
  if (await getUser()) redirect("/");

  return <SignInForm />;
}
