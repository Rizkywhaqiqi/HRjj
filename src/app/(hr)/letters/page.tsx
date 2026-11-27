import Link from "next/link";
import {
  hasPermission,
  requireFeatureEnabled,
  requirePermission,
} from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  createLetterAction,
  listLetters,
  listLetterEmployees,
  getLetterContractDefaults,
} from "@/modules/letters";
import {
  LETTER_LABELS,
  type LetterType,
  parseSnapshot,
} from "@/modules/letters/templates";
import { todayInJakarta } from "@/modules/letters/date";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  EmptyState,
  buttonSecondary,
} from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import { firstParam, formatDate } from "@/components/shared/format";
import { listContractTypes } from "@/modules/master-data";
import { nextContractDate } from "@/modules/contracts/date";
import LetterComposer from "./letter-composer";
export const instant = false;
export default async function LettersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.letterView);
  await requireFeatureEnabled("letters");
  const params = await searchParams;
  const positiveId = (v: string | undefined) => {
    const n = Number(v);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  };
  const employeeId = positiveId(firstParam(params.employeeId));
  const contractId = positiveId(firstParam(params.contractId));
  const renewal = firstParam(params.flow) === "renewal";
  const rawType = firstParam(params.type) ?? "SKK";
  const type = (rawType in LETTER_LABELS ? rawType : "SKK") as LetterType;
  const canCreate = hasPermission(actor, PERMISSIONS.letterCreate);
  const [letters, employees] = await Promise.all([
    listLetters(actor, employeeId > 0 ? employeeId : null),
    canCreate ? listLetterEmployees(actor) : Promise.resolve([]),
  ]);
  const contractDefaults =
    canCreate && contractId && employeeId
      ? await getLetterContractDefaults(actor, employeeId, contractId, renewal)
      : null;
  const contractTypes = canCreate ? await listContractTypes() : [];
  const invalidContract = Boolean(contractId && !contractDefaults);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Surat & riwayat"
        description="Buat surat dari template bawaan. Riwayat menyimpan isi asli; PDF dibuat saat dibutuhkan."
        action={
          <Link href="/employees" className={buttonSecondary}>
            Daftar karyawan
          </Link>
        }
      />
      <FlashAlerts {...readFlash(params)} />
      {canCreate ? (
        <Card>
          <CardHeader
            title="Buat surat"
            description="1. Pilih karyawan dan jenis surat · 2. Lengkapi isi · 3. Periksa dan simpan"
          />
          <CardBody>
            {invalidContract ? (
              <p role="alert" className="text-sm text-rose-700">
                Kontrak tidak ditemukan, sudah diproses, atau sudah memiliki
                surat. Buka riwayat untuk mengunduh surat yang ada.
              </p>
            ) : (
              <LetterComposer
                employees={employees.map((e) => ({
                  id: e.id,
                  full_name: e.full_name,
                  employee_code: e.employee_code,
                }))}
                employeeId={employeeId}
                contractId={renewal ? 0 : contractId}
                previousContractId={renewal ? contractId : 0}
                contractTypeId={contractDefaults?.contract_type_id}
                contractTypes={contractTypes
                  .filter((t) => t.is_active)
                  .map((t) => ({
                    id: t.id,
                    name: t.name,
                    is_permanent: Boolean(t.is_permanent),
                  }))}
                defaults={
                  contractDefaults
                    ? {
                        startDate: renewal
                          ? nextContractDate(contractDefaults.end_date!)
                          : contractDefaults.start_date,
                        endDate: renewal
                          ? ""
                          : (contractDefaults.end_date ?? ""),
                        salary: contractDefaults.base_salary ?? "",
                      }
                    : undefined
                }
                type={type}
                date={todayInJakarta()}
                signatory={actor.name}
                action={createLetterAction}
              />
            )}
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardHeader
          title="Riwayat surat"
          description={`${letters.length} surat terbaru${employeeId ? " untuk karyawan terpilih" : ""}. Unduh ulang memakai nomor dan isi yang sama.`}
          action={
            employeeId ? (
              <Link href="/letters" className={buttonSecondary}>
                Semua riwayat
              </Link>
            ) : undefined
          }
        />
        <CardBody>
          {letters.length ? (
            <div className="responsive-table-wrap overflow-x-auto">
              <table
                role="table"
                className="responsive-data-table w-full text-left text-sm"
              >
                <thead
                  role="rowgroup"
                  className="border-b text-xs uppercase text-slate-500"
                >
                  <tr role="row">
                    {[
                      "Nomor surat",
                      "Karyawan",
                      "Jenis",
                      "Tanggal",
                      "Dokumen",
                    ].map((h) => (
                      <th scope="col" key={h} className="px-3 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-100">
                  {letters.map((l) => (
                    <tr role="row" key={l.id}>
                      <td role="cell" className="px-3 py-4 font-medium">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Nomor surat
                        </span>
                        {l.letter_number}
                      </td>
                      <td role="cell" className="px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Karyawan
                        </span>
                        {parseSnapshot(l.metadata)?.employeeName ?? l.full_name}
                      </td>
                      <td role="cell" className="px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Jenis
                        </span>
                        {LETTER_LABELS[l.type as LetterType] ?? l.type}
                      </td>
                      <td role="cell" className="px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Tanggal
                        </span>
                        {formatDate(l.issued_date)}
                      </td>
                      <td role="cell" className="px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Dokumen
                        </span>
                        <Link
                          href={`/letters/${l.id}/preview`}
                          className={buttonSecondary}
                        >
                          Preview & unduh
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Belum ada surat"
              description="Pilih karyawan di atas untuk membuat surat pertama."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
