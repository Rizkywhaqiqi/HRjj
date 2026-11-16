import Link from "next/link";
import { hasPermission, requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  listLetters,
  listLetterTemplates,
  getLetterEmployeeContext,
  getLetterContractContext,
  createLetterAction,
  submitLetterForApprovalAction,
  approveLetterAction,
  issueLetterAction,
  deleteLetterAction,
  uploadLetterTemplateAction,
  setLetterTemplateActiveAction,
} from "@/modules/letters";
import { listCompanyOptions } from "@/modules/master-data";
import { Card, CardBody, CardHeader, PageHeader, Badge, inputClass, buttonPrimary, buttonSecondary, buttonDanger } from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import { firstParam, formatDate } from "@/components/shared/format";
import { todayInJakarta } from "@/modules/letters/date";

export const instant = false;

function statusTone(status: string): "neutral" | "warning" | "info" | "success" {
  if (status === "PENDING_APPROVAL") return "warning";
  if (status === "APPROVED") return "info";
  if (status === "ISSUED") return "success";
  return "neutral";
}

function statusLabel(status: string): string {
  if (status === "ISSUED") return "Tersimpan";
  if (status === "DRAFT") return "Draf";
  if (status === "PENDING_APPROVAL") return "Menunggu persetujuan";
  if (status === "APPROVED") return "Disetujui";
  return status;
}

function letterTypeLabel(type: string): string {
  return type === "CONTRACT" ? "Penawaran kerja" : type;
}

function dateAfter(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default async function LettersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission(PERMISSIONS.letterView);
  await requireFeatureEnabled("letters");
  const params = await searchParams;
  const rawEmployeeId = firstParam(params.employeeId) ?? "";
  const parsedEmployeeId = Number(rawEmployeeId);
  const selectedEmployeeId =
    Number.isSafeInteger(parsedEmployeeId) && parsedEmployeeId > 0
      ? parsedEmployeeId
      : null;
  const parsedContractId = Number(firstParam(params.contractId));
  const selectedContractId =
    Number.isSafeInteger(parsedContractId) && parsedContractId > 0
      ? parsedContractId
      : null;
  const selectedType = firstParam(params.type);
  const isRenewalProposal = firstParam(params.flow) === "renewal";
  const canCreate = hasPermission(actor, PERMISSIONS.letterCreate);
  const canApprove = hasPermission(actor, PERMISSIONS.letterApprove);
  const canIssue = hasPermission(actor, PERMISSIONS.letterIssue);
  const [letters, templates, companies, selectedEmployee, selectedContract] = await Promise.all([
    listLetters(actor, selectedEmployeeId),
    listLetterTemplates(actor),
    listCompanyOptions(actor),
    selectedEmployeeId
      ? getLetterEmployeeContext(actor, selectedEmployeeId)
      : Promise.resolve(null),
    selectedEmployeeId && selectedContractId
      ? getLetterContractContext(actor, selectedEmployeeId, selectedContractId)
      : Promise.resolve(null),
  ]);
  const contractLetterUnavailable =
    selectedContractId !== null &&
    (!selectedContract ||
      selectedContract.status !== "RUNNING" ||
      (selectedContract.letter_id !== null && !isRenewalProposal));
  const offerStartDefault = selectedContract
    ? isRenewalProposal && selectedContract.contract_end_date
      ? dateAfter(selectedContract.contract_end_date)
      : selectedContract.contract_start_date
    : "";
  const offerEndDefault = isRenewalProposal
    ? ""
    : selectedContract?.contract_end_date ?? "";

  return (
    <div>
      <PageHeader title="Arsip surat karyawan" description="Buat surat dari profil karyawan dan simpan dokumennya ke riwayat surat." />
      <FlashAlerts {...readFlash(params)} />
      {canCreate ? (
        <>
          <details className="mb-5 rounded-2xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-700">
              Pengaturan template (admin)
            </summary>
            <div className="space-y-5 border-t border-slate-100 p-4">
              <Card>
                <CardHeader title="Upload template DOCX" />
                <CardBody>
                  <form action={uploadLetterTemplateAction} className="grid gap-3 sm:grid-cols-4">
                    <input name="name" required placeholder="Nama template" className={inputClass} />
                    <select name="type" required className={inputClass}>
                      <option value="">Jenis surat</option>
                      <option value="SP">SP</option>
                      <option value="SKK">SKK</option>
                      <option value="CONTRACT">Penawaran kerja</option>
                      <option value="NDA">NDA</option>
                      <option value="STILL_WORKING">Masih bekerja</option>
                    </select>
                    <select name="companyId" className={inputClass}>
                      <option value="">Template global</option>
                      {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                    </select>
                    <input
                      name="template"
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      required
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button className={`${buttonPrimary} sm:col-span-4`}>Upload template</button>
                  </form>
                  <p className="mt-2 text-xs text-slate-500">
                    Template CV diprioritaskan; template global digunakan sebagai fallback. Template penawaran kerja tersedia tanpa upload. Placeholder DOCX: full_name, employee_code, position_name, location_name, location_city, company_name, company_address, company_phone, issued_date, contract_type_name, contract_start_date, contract_end_date, offer_start_date, offer_end_date, offered_salary, reporting_to, training_period, dan work_hours.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Jenis Kontrak memiliki template Offer Letter bawaan. Upload template DOCX khusus hanya diperlukan jika ingin mengganti format bawaan.
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Tinjau kembali kompensasi dan ketentuan surat bersama HR/legal sebelum diterbitkan.
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Template terdaftar" description="Versi lama dapat dinonaktifkan tanpa menghapus riwayat surat." />
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="border-b text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Jenis</th>
                          <th className="px-3 py-2">Nama</th>
                          <th className="px-3 py-2">CV</th>
                          <th className="px-3 py-2">Versi</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templates.map((template) => (
                          <tr key={template.id} className="border-b border-slate-100">
                            <td className="px-3 py-3">{letterTypeLabel(template.type)}</td>
                            <td className="px-3 py-3 font-medium">{template.name}</td>
                            <td className="px-3 py-3">{template.company_name ?? "Global"}</td>
                            <td className="px-3 py-3">v{template.version}</td>
                            <td className="px-3 py-3">
                              <Badge tone={template.is_active ? "success" : "neutral"}>
                                {template.is_active ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <form action={setLetterTemplateActiveAction}>
                                <input type="hidden" name="templateId" value={template.id} />
                                <input type="hidden" name="nextActive" value={template.is_active ? "0" : "1"} />
                                <button className="text-xs font-semibold text-brand-700">
                                  {template.is_active ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {templates.length === 0 ? <p className="text-sm text-slate-500">Belum ada template.</p> : null}
                </CardBody>
              </Card>
            </div>
          </details>

          <Card className="mb-5">
            <CardHeader title="Buat surat karyawan" />
            <CardBody>
              {contractLetterUnavailable ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {selectedContract?.letter_id ? (
                    <>
                      Kontrak ini sudah memiliki surat.{" "}
                      <Link href={`/letters/${selectedContract.letter_id}/preview`} className="font-semibold underline">
                        Lihat surat
                      </Link>
                    </>
                  ) : (
                    "Kontrak tidak ditemukan, tidak aktif, atau berada di luar akses Anda."
                  )}
                </div>
              ) : selectedEmployeeId && !selectedEmployee ? (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  Karyawan aktif tidak ditemukan atau berada di luar akses Anda. Pilih karyawan dari daftar.
                </p>
              ) : selectedEmployee && selectedEmployee.company_name === null ? (
                <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  CV karyawan belum ditentukan. Pilih CV melalui edit profil sebelum membuat surat.
                  <Link href={`/employees/${selectedEmployee.id}?mode=edit`} className="ml-1 font-semibold underline">Lengkapi profil</Link>
                </p>
              ) : selectedEmployee ? (
                <form action={createLetterAction} className="grid gap-3 sm:grid-cols-3">
                  <input name="employeeId" type="hidden" value={selectedEmployee.id} />
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm sm:col-span-3">
                    <span className="min-w-0 text-slate-700">
                      <b>{selectedEmployee.full_name}</b> · {selectedEmployee.employee_code}
                      <span className="block text-xs text-slate-500">
                        {selectedEmployee.position_name} · {selectedEmployee.company_name}
                      </span>
                    </span>
                    <Link href="/employees" className="font-semibold text-brand-700 hover:underline">Pilih karyawan lain</Link>
                  </div>
                  {selectedContract ? (
                    <>
                      <input name="contractId" type="hidden" value={selectedContract.id} />
                      <input name="type" type="hidden" value="CONTRACT" />
                      <input name="flow" type="hidden" value={isRenewalProposal ? "renewal" : "new-contract"} />
                      <input name="linkContract" type="hidden" value={isRenewalProposal ? "0" : "1"} />
                      <div className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-900 sm:col-span-3">
                        <p className="font-semibold">
                          {isRenewalProposal ? "Penawaran perpanjangan" : "Offer Letter"}
                          {" · "}
                          {selectedContract.contract_type_name}
                        </p>
                        <p className="mt-1 text-xs">
                          {formatDate(selectedContract.contract_start_date)} — {selectedContract.contract_end_date ? formatDate(selectedContract.contract_end_date) : "Tetap"}
                          {selectedContract.base_salary ? ` · Gaji pokok Rp${new Intl.NumberFormat("id-ID").format(Number(selectedContract.base_salary))}` : ""}
                        </p>
                      </div>
                    </>
                  ) : (
                    <select name="type" required defaultValue={selectedType ?? ""} className={inputClass}>
                      <option value="">Jenis surat</option>
                      <option value="SP">SP</option>
                      <option value="SKK">SKK</option>
                      <option value="CONTRACT">Penawaran kerja (Offer Letter)</option>
                      <option value="NDA">NDA</option>
                      <option value="STILL_WORKING">Masih bekerja</option>
                    </select>
                  )}
                  <label className="grid gap-1 text-xs text-slate-600">
                    Tanggal surat
                    <input
                      name="issuedDate"
                      type="date"
                      required
                      defaultValue={todayInJakarta()}
                      className={inputClass}
                    />
                  </label>
                  <details open={selectedContract !== null || selectedType === "CONTRACT"} className="sm:col-span-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-600">
                      Rincian penawaran kerja
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="grid gap-1 text-xs text-slate-600">
                        Jenis kontrak
                        <input
                          name="offeredContractType"
                          required={selectedType === "CONTRACT" && selectedContract === null}
                          defaultValue={selectedContract?.contract_type_name ?? (selectedType === "CONTRACT" ? "PKWT 2 Bulan" : "")}
                          placeholder="Contoh: Training 2 bulan"
                          className={inputClass}
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-slate-600">
                        Perkiraan mulai bekerja
                        <input
                          name="offerStartDate"
                          type="date"
                          required={selectedContract !== null || selectedType === "CONTRACT"}
                          defaultValue={offerStartDefault}
                          className={inputClass}
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-slate-600">
                        Perkiraan akhir kontrak
                        <input
                          name="offerEndDate"
                          type="date"
                          required={selectedContract !== null && !selectedContract.is_permanent}
                          defaultValue={offerEndDefault}
                          className={inputClass}
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-slate-600">
                        Gaji pokok penawaran
                        <input
                          name="offeredSalary"
                          type="number"
                          min="0"
                          step="0.01"
                          required={selectedContract !== null || selectedType === "CONTRACT"}
                          defaultValue={selectedContract?.base_salary ?? ""}
                          className={inputClass}
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-slate-600">
                        Melapor kepada
                        <input name="reportingTo" placeholder="Jabatan atasan" className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-xs text-slate-600">
                        Masa training
                        <input
                          name="trainingPeriod"
                          defaultValue={
                            !selectedContract || selectedContract.contract_type_name.toLowerCase().includes("2 bulan")
                              ? "2 Bulan"
                              : "Tidak berlaku"
                          }
                          className={inputClass}
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2 lg:col-span-3">
                        Jam kerja
                        <input name="workHours" defaultValue="08.00 - 17.00 WIB" className={inputClass} />
                      </label>
                    </div>
                    {selectedContract ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {isRenewalProposal
                          ? "Ini hanya surat penawaran perpanjangan; record kontrak baru belum dibuat. Periksa kembali tanggal dan gaji sebelum membuat surat."
                          : "Data kontrak aktif menjadi nilai awal surat. Mengubah penawaran tidak mengubah record kontrak yang sudah tersimpan."}
                      </p>
                    ) : null}
                  </details>
                  <button className={`${buttonPrimary} sm:col-span-3`}>
                    {isRenewalProposal
                      ? "Buat & simpan penawaran perpanjangan"
                      : "Buat & simpan surat"}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">Pembuatan surat dimulai dari profil karyawan aktif agar data karyawan terisi otomatis.</p>
                  <Link href="/employees" className={buttonSecondary}>Pilih karyawan</Link>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader
          title={selectedEmployee ? "Riwayat surat" : "Daftar surat"}
          description={selectedEmployee
            ? `${letters.length} surat tersimpan untuk ${selectedEmployee.full_name}.`
            : `${letters.length} surat tersimpan.`}
          action={selectedEmployee ? (
            <Link href="/letters" className={buttonSecondary}>Semua surat</Link>
          ) : null}
        />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nomor</th>
                  <th className="px-3 py-2">Jenis</th>
                  <th className="px-3 py-2">Karyawan</th>
                  <th className="px-3 py-2">CV</th>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {letters.map((letter) => (
                  <tr key={letter.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3 font-medium">{letter.letter_number}</td>
                    <td className="px-3 py-3">{letterTypeLabel(letter.type)}</td>
                    <td className="px-3 py-3">{letter.full_name}</td>
                    <td className="px-3 py-3">{letter.company_name}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(letter.issued_date)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone(letter.status)}>{statusLabel(letter.status)}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/letters/${letter.id}/preview`}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Preview / cetak PDF
                        </Link>
                        {letter.status === "DRAFT" && canCreate ? (
                          <form action={submitLetterForApprovalAction}>
                            <input type="hidden" name="letterId" value={letter.id} />
                            <button className="rounded-lg border px-2 py-1 text-xs">Ajukan</button>
                          </form>
                        ) : null}
                        {letter.status === "PENDING_APPROVAL" && canApprove ? (
                          <form action={approveLetterAction}>
                            <input type="hidden" name="letterId" value={letter.id} />
                            <button className="rounded-lg border px-2 py-1 text-xs">Setujui</button>
                          </form>
                        ) : null}
                        {letter.status === "APPROVED" && canIssue ? (
                          <form action={issueLetterAction}>
                            <input type="hidden" name="letterId" value={letter.id} />
                            <button className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-semibold text-white">Terbitkan</button>
                          </form>
                        ) : null}
                        {letter.status === "ISSUED" ? (
                          <a href={`/api/files/letters/${letter.id}`} className="rounded-lg border px-2 py-1 text-xs font-semibold text-brand-700">
                            Unduh DOCX
                          </a>
                        ) : null}
                        {canCreate && letter.status !== "ISSUED" ? (
                          <details>
                            <summary className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                              Hapus
                            </summary>
                            <form action={deleteLetterAction} className="mt-2 grid min-w-40 gap-2 rounded-lg border border-rose-200 bg-white p-3 shadow-sm">
                              <input type="hidden" name="letterId" value={letter.id} />
                              <p className="text-xs text-slate-600">Hapus surat {letter.letter_number}? Tindakan ini tidak dapat dibatalkan.</p>
                              <button className={`${buttonDanger} text-xs`}>Ya, hapus surat</button>
                            </form>
                          </details>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {letters.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">Belum ada surat.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
