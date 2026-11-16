"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { SubmitButton } from "@/components/ui/form";
import { Alert, Field, inputClass } from "@/components/ui/primitives";
import { loginAction } from "@/modules/users/actions";
import type { LoginActionState } from "@/modules/users/schema";

const initialState: LoginActionState = { status: "idle" };

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className={inputClass}
          placeholder="nama@perusahaan.co.id"
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
          placeholder="••••••••••••"
        />
      </Field>

      <SubmitButton pendingLabel="Memverifikasi..." className="w-full">
        <LogIn aria-hidden="true" size={16} />
        Masuk
      </SubmitButton>
    </form>
  );
}
