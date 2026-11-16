import Link from "next/link";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  inputClass,
  PageHeader,
  buttonSecondary,
} from "@/components/ui/primitives";
import { firstParam } from "@/components/shared/format";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  countPendingEmployeeStaging,
  listPendingEmployeeStaging,
} from "@/modules/employees";

export const instant = false;

const PAGE_SIZE = 50;

const REVIEW_LABELS: Record<string, string> = {
  CANDIDATE_DATA: "Berasal dari kandidat diterima",
  COMPANY_MAPPING_PENDING: "Perusahaan belum dipetakan",
  POSITION_MAPPING_PENDING: "Jabatan belum dipetakan",
  LOCATION_MAPPING_PENDING: "Lokasi menunggu pemetaan",
  NIK_MISSING: "NIK belum tersedia",
  NIK_NUMERIC_EXCEL_REVIEW: "NIK angka perlu diverifikasi",
  NIK_INVALID_FORMAT: "Format NIK perlu diperiksa",
  NIK_DUPLICATE_IN_SOURCE: "NIK duplikat di file",
  NIK_ALREADY_IN_EMPLOYEE_TABLE: "NIK sudah tercatat",
  FORMULA_CELL_REVIEW: "Ada sel formula untuk ditinjau",
};

function getPageNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function EmployeeStagingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.employeeCreate);
  await requireFeatureEnabled("employees");

  const params = await searchParams;
  const search = firstParam(params.search)?.trim() ?? "";
  const total = await countPendingEmployeeStaging(actor, search);
  const page = Math.min(getPageNumber(firstParam(params.page)), Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const rows = await listPendingEmployeeStaging(
    actor,
    search,
    PAGE_SIZE,
    (page - 1) * PAGE_SIZE,
  );
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Data karyawan belum lengkap"
        description="Kandidat yang diterima masuk ke sini untuk melengkapi data sebelum diaktifkan sebagai karyawan."
        action={
          <Link href="/employees" className={buttonSecondary}>
            Kembali ke karyawan
          </Link>
        }
      />

      <Card className="mb-5">
        <CardBody>
          <p className="text-sm leading-6 text-slate-700">
            Data sumber kandidat disimpan terenkripsi. NIK atau informasi lain
            yang belum tersedia tidak dibuat-buat dan dapat dilengkapi sebelum
            atau setelah data karyawan aktif.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Data yang perlu dilengkapi"
          description={`${total} data menunggu dilengkapi`}
        />
        <CardBody>
          <form method="get" className="mb-5 flex flex-col gap-2 sm:flex-row">
            <input
              name="search"
              defaultValue={search}
              placeholder="Cari nama"
              aria-label="Cari nama di data staging"
              className={inputClass}
            />
            <button type="submit" className={buttonSecondary}>
              Cari
            </button>
            {search ? (
              <Link href="/employees/staging" className={buttonSecondary}>
                Hapus pencarian
              </Link>
            ) : null}
          </form>

          {rows.length === 0 ? (
            <EmptyState
              title="Belum ada data staging"
              description="Data karyawan yang belum lengkap akan muncul di sini."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3 font-semibold">Nama</th>
                      <th className="px-3 py-3 font-semibold">Sumber</th>
                      <th className="px-3 py-3 font-semibold">Yang perlu ditinjau</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-3 font-medium text-slate-900">
                          {row.full_name}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          Lamaran #{row.application_id}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {row.review_flags.map((flag) => (
                              <Badge key={flag} tone="warning">
                                {REVIEW_LABELS[flag] ?? "Perlu ditinjau"}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone="neutral">Menunggu data lengkap</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/employees/staging/${row.id}`}
                            className={buttonSecondary}
                          >
                            Lengkapi
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>Halaman {page} dari {pageCount}</span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/employees/staging?${new URLSearchParams({ ...(search ? { search } : {}), page: String(page - 1) })}`}
                      className={buttonSecondary}
                    >
                      Sebelumnya
                    </Link>
                  ) : null}
                  {page < pageCount ? (
                    <Link
                      href={`/employees/staging?${new URLSearchParams({ ...(search ? { search } : {}), page: String(page + 1) })}`}
                      className={buttonSecondary}
                    >
                      Berikutnya
                    </Link>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
