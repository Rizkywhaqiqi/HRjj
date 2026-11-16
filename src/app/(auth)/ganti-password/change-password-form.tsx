"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { SubmitButton } from "@/components/ui/form";
import { Alert, Field, inputClass } from "@/components/ui/primitives";
import { changePasswordAction } from "@/modules/users/actions";
import type { ChangePasswordState } from "@/modules/users/schema";

const initialState: ChangePasswordState = { status: "idle" };

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}

      <Field label="Password saat ini" htmlFor="currentPassword">
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>

      <Field
        label="Password baru"
        htmlFor="newPassword"
        hint="Minimal 12 karakter. Gunakan kombinasi huruf, angka, dan simbol."
      >
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={12}
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      <Field label="Konfirmasi password baru" htmlFor="confirmPassword">
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={12}
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      <SubmitButton pendingLabel="Memperbarui...">
        <KeyRound aria-hidden="true" size={16} />
        Perbarui password
      </SubmitButton>
    </form>
  );
}
