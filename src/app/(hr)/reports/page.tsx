import Link from "next/link";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listEmployeeReport, employeeReportSummary } from "@/modules/reports";
import { reportAccess } from "@/modules/reports/access";
import { reportFilters, reportFilterQuery } from "@/modules/reports/filters";
import {
  listBrandOptions,
  listCompanyOptions,
  listDivisionOptions,
  listLocations,
} from "@/modules/master-data";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  EmptyState,
  Badge,
  inputClass,
  buttonPrimary,
  buttonSecondary,
} from "@/components/ui/primitives";
import { parsePage } from "@/components/shared/pagination";
import { formatDate } from "@/components/shared/format";
import ReportPagination from "./report-pagination";
export const instant = false;
const PAGE_SIZE = 25;
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.reportView);
  await requireFeatureEnabled("reports");
  const params = await searchParams;
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => typeof v === "string") as [
      string,
      string,
    ][],
  );
  const filters = reportFilters(search);
  const query = reportFilterQuery(filters);
  const access = reportAccess(actor);
  const [summary, brands, companies, divisions, locations] = await Promise.all([
    employeeReportSummary(actor, filters),
    listBrandOptions(actor),
    listCompanyOptions(actor),
    listDivisionOptions(),
    listLocations(actor),
  ]);
  const page = Math.min(
    parsePage(params.page),
    Math.max(1, Math.ceil(Number(summary.total) / PAGE_SIZE)),
  );
  const rows = await listEmployeeReport(actor, filters, {
    includePrivate: false,
    includeSensitive: false,
    page,
    pageSize: PAGE_SIZE,
  });
  const canExport = actor.permissions.includes(PERMISSIONS.reportExport);
  const select = (
    name: string,
    label: string,
    value: number | undefined,
    options: { id: number; name: string }[],
  ) => (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
      {label}
      <select name={name} defaultValue={value ?? ""} className={inputClass}>
        <option value="">Semua {label.toLowerCase()}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Laporan karyawan"
        description="Tinjau rekap dan unduh data sesuai izin serta brand yang dapat Anda akses."
        action={
          canExport ? (
            <div className="flex flex-wrap gap-2">
              {["csv", "xlsx", "pdf"].map((format) => (
                <a
                  key={format}
                  href={`/api/reports/employees.${format}?${new URLSearchParams(query)}`}
                  className={
                    format === "xlsx" ? buttonPrimary : buttonSecondary
                  }
                >
                  {format === "xlsx"
                    ? "Export Excel"
                    : `Export ${format.toUpperCase()}`}
                </a>
              ))}
            </div>
          ) : undefined
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total hasil", summary.total],
          ["Aktif", summary.active],
          ["Nonaktif", summary.inactive],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardBody>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {value}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
      <Card>
        <CardBody>
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
              Cari nama atau kode
              <input
                name="search"
                type="search"
                maxLength={80}
                defaultValue={filters.search ?? ""}
                className={inputClass}
                placeholder="Nama atau kode karyawan"
              />
            </label>
            {select("brand", "Brand", filters.brandId, brands)}
            {select("company", "Perusahaan", filters.companyId, companies)}
            {select("division", "Divisi", filters.divisionId, divisions)}
            {select("location", "Lokasi", filters.locationId, locations)}
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
              Status
              <select
                name="status"
                defaultValue={filters.status ?? ""}
                className={inputClass}
              >
                <option value="">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                name="incomplete"
                type="checkbox"
                value="1"
                defaultChecked={filters.incompleteOnly}
              />
              Hanya profil aktif belum lengkap
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button className={buttonPrimary}>Terapkan filter</button>
              <Link href="/reports" className={buttonSecondary}>
                Reset
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
      <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <p className="font-semibold">Isi ekspor mengikuti hak akses akun</p>
        <p className="mt-1 text-xs leading-5">
          Data dasar pekerjaan{access.includePrivate ? ", data pribadi" : ""}
          {access.includeSensitive
            ? ", NIK, NPWP, rekening, dan status dokumen KTP"
            : ""}
          .{" "}
          {canExport
            ? "Ekspor memuat seluruh hasil filter, bukan hanya halaman yang sedang dibuka."
            : "Akun ini belum memiliki izin ekspor."}
        </p>
      </div>
      <Card className="overflow-hidden">
        <CardHeader
          title="Data karyawan"
          description="25 data per halaman. Ringkasan di atas dihitung dari seluruh hasil filter."
        />
        <div className="overflow-x-auto">
          {rows.length ? (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Kode / nama",
                    "Brand / perusahaan",
                    "Jabatan / divisi",
                    "Lokasi",
                    "Status",
                  ].map((h) => (
                    <th scope="col" key={h} className="px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr
                    key={r.employee_code}
                    className="align-top hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {r.full_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {r.employee_code}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {r.brand_name}
                      <p className="mt-1 text-xs text-slate-500">
                        {r.company_name ?? "Belum dipilih"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {r.position_name}
                      <p className="mt-1 text-xs text-slate-500">
                        {r.division_name}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {r.location_name}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={r.is_active ? "success" : "neutral"}>
                        {r.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                      {!r.is_active && r.exit_date ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(r.exit_date)}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <CardBody>
              <EmptyState
                title="Tidak ada hasil laporan"
                description="Ubah pencarian atau filter untuk menampilkan data karyawan."
              />
            </CardBody>
          )}
        </div>
        <ReportPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={Number(summary.total)}
          query={query}
        />
      </Card>
    </div>
  );
}
