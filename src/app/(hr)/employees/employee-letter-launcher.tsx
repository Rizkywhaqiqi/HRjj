"use client";

import { useEffect, useState } from "react";
import {
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui/primitives";
import type { LetterType } from "@/modules/letters/schema";

const LETTER_TYPES: { value: LetterType; label: string }[] = [
  { value: "CONTRACT", label: "Penawaran kerja" },
  { value: "SP", label: "Surat Peringatan (SP)" },
  { value: "SKK", label: "Surat Keterangan Kerja (SKK)" },
  { value: "NDA", label: "Perjanjian Kerahasiaan (NDA)" },
  { value: "STILL_WORKING", label: "Surat Keterangan Masih Bekerja" },
];

interface EmployeeLetterLauncherProps {
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
    positionName: string;
    companyName: string;
    locationName: string;
    joinDate: string | null;
  };
  availableTypes: LetterType[];
  issuedDate: string;
  createAction: (formData: FormData) => Promise<void>;
}

export default function EmployeeLetterLauncher({
  employee,
  availableTypes,
  issuedDate,
  createAction,
}: EmployeeLetterLauncherProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<LetterType | null>(null);

  useEffect(() => {
    if (!selectedType) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedType(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedType]);

  const selectedLabel =
    LETTER_TYPES.find((item) => item.value === selectedType)?.label ?? "";

  return (
    <>
      <div className="relative">
        <button
          type="button"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex min-h-10 items-center rounded-xl border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
        >
          Buat surat
          <span className="ml-2" aria-hidden="true">⌄</span>
        </button>
        {menuOpen ? (
          <div
            className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
          >
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pilih jenis surat
            </p>
            {LETTER_TYPES.map((item) => {
              const available = availableTypes.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    setMenuOpen(false);
                    setSelectedType(item.value);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  <span>{item.label}</span>
                  {!available ? (
                    <span className="shrink-0 text-[11px]">Template belum ada</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {selectedType ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedType(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-letter-dialog-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  Buat surat karyawan
                </p>
                <h2
                  id="employee-letter-dialog-title"
                  className="mt-1 text-lg font-semibold text-slate-900"
                >
                  {selectedLabel}
                </h2>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setSelectedType(null)}
                aria-label="Tutup form surat"
                className="rounded-lg px-3 py-2 text-lg leading-none text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </header>

            <form action={createAction} className="grid gap-4 p-5 sm:p-6">
              <input type="hidden" name="employeeId" value={employee.id} />
              <input type="hidden" name="type" value={selectedType} />
              <input type="hidden" name="returnPath" value="/employees" />

              <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{employee.fullName}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {employee.employeeCode} · {employee.positionName} · {employee.companyName}
                </p>
                <p className="text-xs text-slate-600">{employee.locationName}</p>
                <p className="mt-2 text-xs text-brand-800">
                  Nama dan identitas surat diambil otomatis dari profil karyawan.
                </p>
              </div>

              <label className="grid gap-1 text-sm text-slate-700">
                Tanggal surat
                <input
                  name="issuedDate"
                  type="date"
                  required
                  defaultValue={issuedDate}
                  className={inputClass}
                />
              </label>

              {selectedType === "CONTRACT" ? (
                <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                  <legend className="px-1 text-sm font-semibold text-slate-700">
                    Rincian penawaran kerja
                  </legend>
                  <label className="grid gap-1 text-xs text-slate-600">
                    Jenis kontrak
                    <input
                      name="offeredContractType"
                      required
                      defaultValue="PKWT 2 Bulan"
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-600">
                    Perkiraan mulai bekerja
                    <input
                      name="offerStartDate"
                      type="date"
                      required
                      defaultValue={employee.joinDate ?? ""}
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-600">
                    Perkiraan akhir kontrak
                    <input name="offerEndDate" type="date" className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-600">
                    Gaji pokok penawaran
                    <input
                      name="offeredSalary"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-600">
                    Melapor kepada
                    <input name="reportingTo" placeholder="Jabatan atasan" className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-600">
                    Masa training
                    <input name="trainingPeriod" defaultValue="2 Bulan" className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">
                    Jam kerja
                    <input name="workHours" defaultValue="08.00 - 17.00 WIB" className={inputClass} />
                  </label>
                  <p className="text-xs leading-5 text-amber-800 sm:col-span-2">
                    Membuat penawaran tidak otomatis membuat kontrak aktif. Periksa kembali rincian sebelum menyimpan.
                  </p>
                </fieldset>
              ) : null}

              <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className={buttonSecondary}
                >
                  Batal
                </button>
                <button type="submit" className={buttonPrimary}>
                  Buat & simpan surat
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
