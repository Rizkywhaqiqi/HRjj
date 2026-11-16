"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonDanger, buttonPrimary, buttonSecondary, cn } from "./primitives";

const VARIANTS = {
  primary: buttonPrimary,
  secondary: buttonSecondary,
  danger: buttonDanger,
} as const;

export function SubmitButton({
  children,
  pendingLabel = "Menyimpan...",
  variant = "primary",
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(VARIANTS[variant], className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
