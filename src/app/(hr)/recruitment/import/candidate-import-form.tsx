"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";

interface VacancyOption {
  id: number;
  title: string;
  companyName: string;
}

interface ImportResult {
  total?: number;
  valid?: number;
  invalid?: number;
  committed?: number;
  error?: string;
  rows?: Array<{
    row: number;
    fullName: string | null;
    email: string | null;
    errors: string[];
  }>;
}

export default function CandidateImportForm({
  vacancies,
}: {
  vacancies: VacancyOption[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [vacancyId, setVacancyId] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState(false);

  async function send(mode: "preview" | "commit") {
    if (!file || !vacancyId || pending) return;
    setPending(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("vacancyId", vacancyId);
      form.set("mode", mode);
      const response = await fetch("/api/recruitment/import", {
        method: "POST",
        body: form,
      });
      const payload = await response.json() as ImportResult;
      setResult(response.ok ? payload : { ...payload, error: payload.error ?? "Import gagal." });
    } catch {
      setResult({ error: "Tidak dapat menghubungi server. Coba lagi." });
    } finally {
      setPending(false);
    }
  }

  function changeFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
  }

  return (
    <div className="grid gap-4">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Lowongan terbuka
        <select
          value={vacancyId}
          onChange={(event) => {
            setVacancyId(event.target.value);
            setResult(null);
          }}
          className="min-h-11 rounded-xl border border-slate-300 px-3 py-2"
        >
          <option value="">Pilih lowongan</option>
          {vacancies.map((vacancy) => (
            <option key={vacancy.id} value={vacancy.id}>
              {vacancy.title} · {vacancy.companyName}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        File kandidat (XLSX)
        <input
          type="file"
          accept=".xlsx"
          onChange={changeFile}
          className="block w-full text-sm"
        />
      </label>

      <p className="text-xs leading-5 text-slate-500">
        Pastikan nomor telepon disimpan sebagai teks agar angka 0 di depan tidak
        hilang. File maksimal 500 baris dan 10 MB.
      </p>

      <div className="flex flex-wrap gap-2">
        <a
          href="/api/recruitment/import/template"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Unduh template
        </a>
        <button
          type="button"
          onClick={() => void send("preview")}
          disabled={!file || !vacancyId || pending}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Memproses..." : "Preview"}
        </button>
        <button
          type="button"
          onClick={() => void send("commit")}
          disabled={
            !file ||
            !vacancyId ||
            !result ||
            result.invalid !== 0 ||
            result.committed !== undefined ||
            pending
          }
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Simpan kandidat
        </button>
      </div>

      {result ? (
        <div aria-live="polite" className="rounded-xl bg-slate-50 p-4 text-sm">
          {result.error ? (
            <p className="text-rose-700">{result.error}</p>
          ) : result.committed !== undefined ? (
            <p className="text-emerald-700">
              {result.committed} lamaran kandidat berhasil diimpor.
            </p>
          ) : (
            <>
              <p>
                Total: {result.total} · Valid: {result.valid} · Tidak valid: {result.invalid}
              </p>
              {result.rows?.some((row) => row.errors.length > 0) ? (
                <ul className="mt-3 space-y-1 text-xs text-rose-700">
                  {result.rows
                    .filter((row) => row.errors.length > 0)
                    .map((row) => (
                      <li key={row.row}>
                        Baris {row.row} ({row.fullName ?? row.email ?? "-"}):{" "}
                        {row.errors.join("; ")}
                      </li>
                    ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
