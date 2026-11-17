"use client";
import { useState } from "react";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/ui/primitives";
interface Result {
  total?: number;
  valid?: number;
  invalid?: number;
  committed?: number;
  error?: string;
  rows?: Array<{
    row: number;
    employeeCode: string | null;
    fullName: string | null;
    errors: string[];
  }>;
}
export default function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(mode: "preview" | "commit") {
    if (!file || busy) return;
    setBusy(true);
    try {
      const f = new FormData();
      f.set("file", file);
      f.set("mode", mode);
      const response = await fetch("/api/employees/import", {
        method: "POST",
        body: f,
      });
      const data = await response.json();
      setResult(data);
      if (data.committed !== undefined) setFile(null);
    } catch {
      setResult({
        error: "Tidak dapat memproses file. Periksa koneksi lalu coba lagi.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        File karyawan (.xlsx)
        <input
          type="file"
          accept=".xlsx"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
          }}
          className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => send("preview")}
          className={buttonSecondary}
        >
          {busy ? "Memproses…" : "Periksa file"}
        </button>
        <button
          type="button"
          disabled={
            !file ||
            busy ||
            result?.invalid !== 0 ||
            !result?.total ||
            result.committed !== undefined
          }
          onClick={() => send("commit")}
          className={buttonPrimary}
        >
          Simpan {result?.valid ?? 0} karyawan
        </button>
      </div>
      <div aria-live="polite">
        {result ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            {result.error ? (
              <p className="text-rose-700">{result.error}</p>
            ) : result.committed !== undefined ? (
              <p className="text-emerald-700">
                {result.committed} karyawan tersimpan.{" "}
                <Link href="/employees" className="underline">
                  Buka daftar karyawan
                </Link>
              </p>
            ) : (
              <>
                <p className="font-semibold">
                  {result.total} baris · {result.valid} valid · {result.invalid}{" "}
                  perlu diperbaiki
                </p>
                <div className="mt-3 max-h-80 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr>
                        <th className="p-2">Baris</th>
                        <th>Nama</th>
                        <th>Hasil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows?.map((r) => (
                        <tr key={r.row} className="border-t border-slate-200">
                          <td className="p-2">{r.row}</td>
                          <td>{r.fullName ?? "—"}</td>
                          <td
                            className={
                              r.errors.length
                                ? "text-rose-700"
                                : "text-emerald-700"
                            }
                          >
                            {r.errors.join("; ") || "Siap disimpan"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
