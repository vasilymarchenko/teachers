import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";

/**
 * A form, not an `onClick`: signing out is a mutation, so it goes through a
 * Server Action and keeps working without JavaScript.
 */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline">
        Вийти
      </Button>
    </form>
  );
}
