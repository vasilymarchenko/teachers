"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
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

      <Field
        name="email"
        label="Електронна пошта"
        type="email"
        autoComplete="username"
        defaultValue={state.email}
        error={state.fieldErrors?.email}
      />
      <Field
        name="password"
        label="Пароль"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function Field({
  name,
  label,
  type,
  autoComplete,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  defaultValue?: string;
  error?: string;
}) {
  const errorId = `${name}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="border-input focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
      />
      {error ? (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton() {
  // `useFormStatus` has to be read by a child of the form, not by the form.
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Входимо…" : "Увійти"}
    </Button>
  );
}
