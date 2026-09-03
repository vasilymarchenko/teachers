"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { signInAction, type SignInState } from "@/lib/actions/auth";

const initialState: SignInState = {};

export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Вхід</h1>
        <p className="text-muted-foreground text-sm">Щоденник учителя</p>
      </div>

      <FormField
        name="email"
        label="Електронна пошта"
        error={state.fieldErrors?.email}
      >
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="username"
            defaultValue={state.email}
            required
          />
        )}
      </FormField>

      <FormField name="password" label="Пароль" error={state.fieldErrors?.password}>
        {(props) => (
          <Input {...props} type="password" autoComplete="current-password" required />
        )}
      </FormField>

      <FormMessage>{state.error}</FormMessage>

      <SubmitButton className="w-full" pendingLabel="Входимо…">
        Увійти
      </SubmitButton>
    </form>
  );
}
