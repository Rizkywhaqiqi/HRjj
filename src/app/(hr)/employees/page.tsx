import Link from "next/link";
import { hasPermission, isFeatureEnabled, requirePermission, requireFeatureEnabled } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { countIncompleteEmployees, countPendingEmployeeStaging, listEmployees, deactivateEmployeeAction } from "@/modules/employees";
import { createLetterAction, listLetterTemplates } from "@/modules/letters";
import type { LetterType } from "@/modules/letters/schema";
import { listExitReasons } from "@/modules/master-data";
import { listBrandOptions, listCompanyOptions, listDivisionOptions, listLocations } from "@/modules/master-data";
import type { EmployeeListFilters } from "@/modules/employees/queries";
import { Card, CardBody, CardHeader, PageHeader, Badge, EmptyState, inputClass, buttonDanger, buttonSecondary } from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import { firstParam } from "@/components/shared/format";
import { Pagination, parsePage } from "@/components/shared/pagination";
import { todayInJakarta } from "@/modules/letters/date";
import EmployeeLetterLauncher from "./employee-letter-launcher";

export const instant = false;

const LETTER_TYPES: readonly LetterType[] = [
  "SP",
  "SKK",
  "CONTRACT",
  "NDA",
  "STILL_WORKING",
];

const PAGE_SIZE = 10;

function isLetterType(value: string): value is LetterType {
  return LETTER_TYPES.some((type) => type === value);
}

function availableLetterTypes(
  companyId: number,
  templates: Awaited<ReturnType<typeof listLetterTemplates>>,
): LetterType[] {
  const available = new Set<LetterType>(["CONTRACT"]);
  for (const template of templates) {
    if (
      template.is_active &&
      (template.company_id === null || template.company_id === companyId) &&
      isLetterType(template.type)
    ) {
      available.add(template.type);
    }
  }
  return [...available];
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission(PERMISSIONS.employeeView);
  await requireFeatureEnabled("employees");
  const params = await searchParams;
  const search = firstParam(params.search) ?? "";
  const incompleteOnly = firstParam(params.incomplete) === "1";
  const page = parsePage(params.page);
  const brandId = Number(firstParam(params.brand));
  const companyId = Number(firstParam(params.company));
  const divisionId = Number(firstParam(params.division));
  const locationId = Number(firstParam(params.location));
  const rawStatus = firstParam(params.status);
  const status: EmployeeListFilters["status"] = rawStatus === "active" || rawStatus === "inactive" ? rawStatus : undefined;
  const filters: EmployeeListFilters = {
    brandId: Number.isSafeInteger(brandId) && brandId > 0 ? brandId : undefined,
    companyId: Number.isSafeInteger(companyId) && companyId > 0 ? companyId : undefined,
    divisionId: Number.isSafeInteger(divisionId) && divisionId > 0 ? divisionId : undefined,
    locationId: Number.isSafeInteger(locationId) && locationId > 0 ? locationId : undefined,
    status,
  };
  const canCreate = hasPermission(actor, PERMISSIONS.employeeCreate);
  const canEditProfiles =
    hasPermission(actor, PERMISSIONS.employeeUpdate) &&
    hasPermission(actor, PERMISSIONS.employeeViewPrivateFields);
  const canDeactivate = hasPermission(actor, PERMISSIONS.employeeDeactivate);
  const canViewLetters =
    hasPermission(actor, PERMISSIONS.letterView) &&
    await isFeatureEnabled("letters");
  const canCreateLetter = canViewLetters && hasPermission(actor, PERMISSIONS.letterCreate);
  const canExport = hasPermission(actor, PERMISSIONS.reportExport);
  const [employees, exitReasons, incompleteCount, stagingCount, brands, companies, divisions, locations, letterTemplates] = await Promise.all([
    listEmployees(actor, search, incompleteOnly, page, PAGE_SIZE, filters),
    listExitReasons(),
    countIncompleteEmployees(actor),
    canCreate ? countPendingEmployeeStaging(actor, "") : Promise.resolve(0),
    listBrandOptions(actor),
    listCompanyOptions(actor),
    listDivisionOptions(),
    listLocations(actor),
    canCreateLetter ? listLetterTemplates(actor) : Promise.resolve([]),
  ]);
  const issuedDate = todayInJakarta();
  return (
    <div>
      <PageHeader
        title="Karyawan"
        description={incompleteOnly
          ? "Karyawan aktif dengan profil belum lengkap. Data dapat dilengkapi dari halaman edit kapan saja."
          : "Cari dan tinjau ringkasan karyawan. Profil yang belum lengkap dapat dilanjutkan kapan saja."}
        action={canCreate || incompleteCount > 0 ? (
          <div className="flex flex-wrap gap-2">
            {incompleteCount > 0 ? (
              <Link href="/employees?incomplete=1" className={buttonSecondary}>
                Karyawan belum lengkap ({incompleteCount})
              </Link>
            ) : null}
            {canCreate ? (
              <>
                <Link href="/employees/staging" className={buttonSecondary}>
                  Draft belum aktif ({stagingCount})
                </Link>
                <Link href="/employees/import" className={buttonSecondary}>
                  Import karyawan
                </Link>
              </>
            ) : null}
          </div>
        ) : null}
      />
      <FlashAlerts {...readFlash(params)} />
      <Card>
        <CardHeader
          title={incompleteOnly ? "Karyawan aktif belum lengkap" : "Daftar karyawan"}
          description={`${employees.total} karyawan ditemukan`}
        />
        <CardBody>
          <form method="get" className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              type="search"
              name="search"
              defaultValue={search}
              minLength={2}
              maxLength={80}
              placeholder="Cari nama, kode, atau telepon (min. 2 karakter)"
              aria-label="Cari karyawan berdasarkan nama, kode, atau telepon"
              className={inputClass}
            />
            {incompleteOnly ? <input type="hidden" name="incomplete" value="1" /> : null}
            <select name="brand" defaultValue={filters.brandId ?? ""} className={inputClass} aria-label="Filter brand">
              <option value="">Semua brand</option>
              {brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select name="company" defaultValue={filters.companyId ?? ""} className={inputClass} aria-label="Filter CV">
              <option value="">Semua CV</option>
              {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select name="division" defaultValue={filters.divisionId ?? ""} className={inputClass} aria-label="Filter divisi">
              <option value="">Semua divisi</option>
              {divisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select name="location" defaultValue={filters.locationId ?? ""} className={inputClass} aria-label="Filter lokasi">
              <option value="">Semua lokasi</option>
              {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select name="status" defaultValue={status ?? ""} className={inputClass} aria-label="Filter status">
              <option value="">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <button type="submit" className={buttonSecondary}>Terapkan filter</button>
              {search || filters.brandId || filters.companyId || filters.divisionId || filters.locationId || status || incompleteOnly ? (
                <Link href="/employees" className={buttonSecondary}>Reset filter</Link>
              ) : null}
              {canExport ? (
                <Link
                  href={`/api/reports/employees.pdf?${new URLSearchParams({
                    ...(search ? { search } : {}),
                    ...(filters.brandId ? { brand: String(filters.brandId) } : {}),
                    ...(filters.companyId ? { company: String(filters.companyId) } : {}),
                    ...(filters.divisionId ? { division: String(filters.divisionId) } : {}),
                    ...(filters.locationId ? { location: String(filters.locationId) } : {}),
                    ...(status ? { status } : {}),
                  }).toString()}`}
                  className={buttonSecondary}
                >Export PDF</Link>
              ) : null}
            </div>
          </form>

          {employees.employees.length === 0 ? (
            <EmptyState
              title={incompleteOnly ? "Tidak ada karyawan aktif yang belum lengkap" : "Karyawan tidak ditemukan"}
              description={search ? "Coba kata kunci lain atau hapus pencarian." : incompleteOnly ? "Semua profil karyawan aktif sudah lengkap." : canCreate ? "Belum ada data karyawan. Gunakan menu Tambah karyawan untuk mulai mengisi." : "Data karyawan akan muncul di sini."}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Karyawan</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Jabatan / divisi</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Brand / CV</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Lokasi</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Masa kerja</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
              {employees.employees.map((employee) => (
                <tr key={employee.id} className="align-top transition hover:bg-brand-50/40">
                  <td className="px-4 py-3">
                    <Link href={`/employees/${employee.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                      {employee.full_name}
                    </Link>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">{employee.employee_code}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge tone={employee.is_active ? "success" : "neutral"}>
                        {employee.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                      {employee.is_profile_complete === 0 ? <Badge tone="warning">Belum lengkap</Badge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{employee.position_name}</p>
                    <p className="text-xs text-slate-500">{employee.division_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{employee.brand_name}</p>
                    <p className="text-xs text-slate-500">{employee.company_name ?? "CV belum dipilih"}</p>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-slate-700">{employee.location_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {employee.service_months === null
                      ? "Belum diisi"
                      : `${Math.floor(employee.service_months / 12)} thn ${employee.service_months % 12} bln`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[280px] flex-wrap justify-end gap-1.5">
                      {canEditProfiles && employee.is_active && employee.is_profile_complete === 0 ? (
                        <Link
                          href={`/employees/${employee.id}?mode=edit`}
                          className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                        >
                          Lengkapi data
                        </Link>
                      ) : null}
                      <Link
                        href={`/employees/${employee.id}`}
                        className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                      >
                        Detail
                      </Link>
                      {canCreateLetter && employee.is_active && employee.company_id !== null ? (
                        <EmployeeLetterLauncher
                          employee={{
                            id: employee.id,
                            fullName: employee.full_name,
                            employeeCode: employee.employee_code,
                            positionName: employee.position_name,
                            companyName: employee.company_name ?? "CV belum dipilih",
                            locationName: employee.location_name,
                            joinDate: employee.join_date,
                          }}
                          availableTypes={availableLetterTypes(
                            employee.company_id,
                            letterTemplates,
                          )}
                          issuedDate={issuedDate}
                          createAction={createLetterAction}
                        />
                      ) : null}
                      {canViewLetters ? (
                        <Link
                          href={`/letters?employeeId=${employee.id}`}
                          className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Riwayat surat
                        </Link>
                      ) : null}
                    </div>
                    {canDeactivate && employee.is_active ? (
                      <details className="relative inline-block">
                        <summary className="cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                          Nonaktifkan
                        </summary>
                        <form action={deactivateEmployeeAction} className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
                          <input type="hidden" name="employeeId" value={employee.id} />
                          <label className="grid gap-1 text-xs text-slate-600">
                            Tanggal keluar
                            <input name="exitDate" type="date" required className={inputClass} />
                          </label>
                          <label className="grid gap-1 text-xs text-slate-600">
                            Alasan keluar
                            <select name="exitReasonId" required className={inputClass}>
                              <option value="">Pilih alasan</option>
                              {exitReasons.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                              ))}
                            </select>
                          </label>
                          <button type="submit" className={buttonDanger}>Konfirmasi nonaktif</button>
                        </form>
                      </details>
                    ) : null}
                  </td>
                </tr>
              ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={employees.total}
            basePath="/employees"
            query={{
              search: search || undefined,
              incomplete: incompleteOnly ? "1" : undefined,
              brand: filters.brandId ? String(filters.brandId) : undefined,
              company: filters.companyId ? String(filters.companyId) : undefined,
              division: filters.divisionId ? String(filters.divisionId) : undefined,
              location: filters.locationId ? String(filters.locationId) : undefined,
              status,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
