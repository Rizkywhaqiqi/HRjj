"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { buttonPrimary } from "@/components/ui/primitives";

export default function HrError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isPublicMessage =
    error.message.startsWith("Anda tidak memiliki") ||
    error.message.startsWith("Fitur");

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertTriangle aria-hidden="true" size={22} />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">
        {isPublicMessage ? "Akses ditolak" : "Terjadi kesalahan"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {isPublicMessage
          ? error.message
          : "Permintaan tidak dapat diproses. Coba muat ulang halaman atau hubungi administrator."}
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <button type="button" onClick={reset} className={buttonPrimary}>
          Coba lagi
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Ke dashboard
        </Link>
      </div>
    </div>
  );
}
