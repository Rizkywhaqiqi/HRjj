"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonPrimary, inputClass } from "@/components/ui/primitives";
import { LETTER_LABELS, type LetterType } from "@/modules/letters/templates";
function SaveLetterButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={buttonPrimary}>
      {pending ? "Menyimpan riwayat…" : "Simpan riwayat & buka preview PDF"}
    </button>
  );
}
interface EmployeeOption {
  id: number;
  full_name: string;
  employee_code: string;
}
export default function LetterComposer({
  employees,
  employeeId,
  contractId,
  defaults,
  type,
  date,
  signatory,
  action,
}: {
  employees: EmployeeOption[];
  employeeId: number;
  contractId: number;
  defaults?: { startDate: string; endDate: string; salary: string };
  type: LetterType;
  date: string;
  signatory: string;
  action: (form: FormData) => Promise<void>;
}) {
  const [kind, setKind] = useState<LetterType>(type);
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const employeeName = (id: string) =>
    employees.find((e) => String(e.id) === id)?.full_name ?? "Pilih karyawan";
  function previewForm(form: HTMLFormElement) {
    const data = Object.fromEntries(
      Array.from(new FormData(form), ([k, v]) => [k, String(v)]),
    );
    setPreview(data);
  }
  const label = (name: string, title: string, input: React.ReactNode) => (
    <label
      className="grid gap-1.5 text-sm font-medium text-slate-700"
      htmlFor={name}
    >
      {title}
      {input}
    </label>
  );
  return (
    <form
      action={action}
      onChange={() => setPreview(null)}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {label(
          "employeeId",
          "Karyawan",
          <select
            id="employeeId"
            name="employeeId"
            required
            defaultValue={employeeId || ""}
            className={inputClass}
          >
            <option value="">Pilih karyawan</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} · {e.employee_code}
              </option>
            ))}
          </select>,
        )}
        {label(
          "type",
          "Jenis surat",
          <select
            id="type"
            name="type"
            value={kind}
            onChange={(e) => setKind(e.target.value as LetterType)}
            className={inputClass}
          >
            {Object.entries(LETTER_LABELS).map(([v, t]) => (
              <option value={v} key={v}>
                {t}
              </option>
            ))}
          </select>,
        )}
        {contractId && kind === "CONTRACT" ? (
          <input name="contractId" type="hidden" value={contractId} />
        ) : null}
        {label(
          "issuedDate",
          "Tanggal surat",
          <input
            id="issuedDate"
            name="issuedDate"
            type="date"
            required
            defaultValue={date}
            className={inputClass}
          />,
        )}
        {label(
          "signatory",
          "Nama penandatangan perusahaan",
          <input
            id="signatory"
            name="signatory"
            required
            defaultValue={signatory}
            maxLength={150}
            className={inputClass}
          />,
        )}
        {kind !== "STILL_WORKING" ? (
          <>
            {label(
              "startDate",
              kind === "SP" ? "Mulai berlaku" : "Tanggal mulai",
              <input
                defaultValue={defaults?.startDate}
                id="startDate"
                name="startDate"
                type="date"
                required={kind !== "SKK"}
                className={inputClass}
              />,
            )}
            {label(
              "endDate",
              kind === "SP" ? "Akhir berlaku" : "Tanggal akhir (jika ada)",
              <input
                defaultValue={defaults?.endDate}
                id="endDate"
                name="endDate"
                type="date"
                required={kind === "SP"}
                className={inputClass}
              />,
            )}
          </>
        ) : null}
        {kind === "CONTRACT"
          ? label(
              "salary",
              "Gaji pokok (Rp)",
              <input
                defaultValue={defaults?.salary}
                id="salary"
                name="salary"
                type="number"
                min="0"
                max="1000000000000"
                required
                className={inputClass}
              />,
            )
          : null}
        {kind === "SP" ? (
          <>
            {label(
              "warningLevel",
              "Tingkat peringatan",
              <select
                id="warningLevel"
                name="warningLevel"
                className={inputClass}
              >
                <option>SP1</option>
                <option>SP2</option>
                <option>SP3</option>
              </select>,
            )}
            {label(
              "incident",
              "Uraian kejadian",
              <textarea
                id="incident"
                name="incident"
                required
                maxLength={2000}
                className={inputClass}
              />,
            )}
          </>
        ) : null}
        {kind === "SKK" || kind === "STILL_WORKING"
          ? label(
              "purpose",
              "Keperluan surat",
              <input
                id="purpose"
                name="purpose"
                required
                maxLength={500}
                placeholder="Contoh: pengajuan administrasi bank"
                className={inputClass}
              />,
            )
          : null}
      </div>
      {["SP", "CONTRACT", "NDA"].includes(kind)
        ? label(
            "terms",
            kind === "NDA"
              ? "Ruang lingkup, kewajiban, dan ketentuan kerahasiaan"
              : "Ketentuan dan keterangan",
            <textarea
              id="terms"
              name="terms"
              required={kind !== "SP"}
              rows={6}
              maxLength={12000}
              placeholder="Tuliskan ketentuan yang sudah disepakati perusahaan dan karyawan."
              className={inputClass}
            />,
          )
        : null}
      <p className="text-xs text-slate-500">
        Template disiapkan oleh aplikasi. Tinjau data dan isi sebelum menyimpan.
        Surat tersimpan sebagai riwayat, bukan file PDF.
      </p>
      <button
        type="button"
        onClick={(e) => {
          const form = e.currentTarget.form!;
          if (form.reportValidity()) previewForm(form);
        }}
        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold"
      >
        Periksa sebelum menyimpan
      </button>
      {preview ? (
        <section className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <h3 className="font-semibold">
            Konfirmasi isi · {LETTER_LABELS[kind]}
          </h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              Karyawan: <b>{employeeName(preview.employeeId)}</b>
            </div>
            <div>Tanggal: {preview.issuedDate}</div>
            <div>Penandatangan: {preview.signatory}</div>
            {preview.startDate ? (
              <div>
                Periode: {preview.startDate} –{" "}
                {preview.endDate || "tidak ditentukan"}
              </div>
            ) : null}
            {preview.salary ? (
              <div>
                Gaji pokok: Rp{Number(preview.salary).toLocaleString("id-ID")}
              </div>
            ) : null}
            {preview.warningLevel ? (
              <div>Tingkat: {preview.warningLevel}</div>
            ) : null}
          </dl>
          <p className="whitespace-pre-wrap text-sm">
            {[preview.purpose, preview.incident, preview.terms]
              .filter(Boolean)
              .join("\n\n")}
          </p>
          <p className="text-xs text-slate-600">
            Nomor surat dibuat setelah disimpan. Data ini akan menjadi snapshot
            dan tidak mengikuti perubahan profil berikutnya.
          </p>
          <SaveLetterButton />
        </section>
      ) : null}
    </form>
  );
}
