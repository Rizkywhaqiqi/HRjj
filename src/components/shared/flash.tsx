import { Alert } from "@/components/ui/primitives";

export interface FlashMessages {
  ok?: string;
  error?: string;
}

export function readFlash(
  searchParams: Record<string, string | string[] | undefined>,
): FlashMessages {
  const ok = searchParams.ok;
  const error = searchParams.error;

  return {
    ok: typeof ok === "string" ? ok : undefined,
    error: typeof error === "string" ? error : undefined,
  };
}

export function FlashAlerts({ ok, error }: FlashMessages) {
  if (!ok && !error) {
    return null;
  }

  return (
    <div className="mb-5 space-y-2">
      {ok ? <Alert tone="success">{ok}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
