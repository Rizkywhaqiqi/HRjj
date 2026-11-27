import { redirect } from "next/navigation";
import type { ZodError } from "zod";

/** Blocks open redirects: only same-origin absolute paths are allowed. */
export function sanitizeNextPath(
  value: unknown,
  fallback = "/dashboard",
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return fallback;
  }

  const normalized = new URL(trimmed, "https://internal.invalid");
  if (normalized.origin !== "https://internal.invalid") return fallback;
  return `${normalized.pathname}${normalized.search}${normalized.hash}`;
}

export function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Data tidak valid.";
}

export type FlashKind = "ok" | "error";

/** Redirects to `path` with a human readable flash message in the query string. */
export function redirectWithMessage(
  path: string,
  kind: FlashKind,
  message: string,
): never {
  const url = new URL(path, "http://internal.invalid");
  url.searchParams.set(kind, message);
  redirect(`${url.pathname}${url.search}`);
}
