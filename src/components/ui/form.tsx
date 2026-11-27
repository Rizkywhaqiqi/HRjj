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
  name,
  value,
  pendingLabel = "Menyimpan...",
  variant = "primary",
  className,
  unstyled = false,
}: {
  children: ReactNode;
  name?: string;
  value?: string;
  pendingLabel?: string;
  variant?: keyof typeof VARIANTS;
  className?: string;
  unstyled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={cn(!unstyled && VARIANTS[variant], className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
