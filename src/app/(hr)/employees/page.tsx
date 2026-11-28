import { SubmitButton } from "@/components/ui/form";
import Form from "next/form";
import Link from "next/link";
import {
  hasPermission,
  isFeatureEnabled,
  requirePermission,
  requireFeatureEnabled,
} from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  countIncompleteEmployees,
  listEmployees,
  deactivateEmployeeAction,
} from "@/modules/employees";
import { listExitReasons } from "@/modules/master-data";
import {
  listBrandOptions,
  listCompanyOptions,
  listDivisionOptions,
  listLocations,
} from "@/modules/master-data";
import type { EmployeeListFilters } from "@/modules/employees/queries";
import {
  Card,
  CardBody,
  PageHeader,
  Badge,
  EmptyState,
  inputClass,
  buttonSecondary,
  buttonPrimary,
} from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import { firstParam } from "@/components/shared/format";
import { Pagination, parsePage } from "@/components/shared/pagination";

import {
  Download,
  Search,
  Plus,
  Upload,
  Users,
  ClipboardCheck,
  ArrowUpRight,
  MapPin,
} from "lucide-react";
import EmployeeRowActions from "./employee-row-actions";
export const instant = false;

const PAGE_SIZE = 10;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const status: EmployeeListFilters["status"] =
    rawStatus === "active" || rawStatus === "inactive" ? rawStatus : undefined;
  const filters: EmployeeListFilters = {
    brandId: Number.isSafeInteger(brandId) && brandId > 0 ? brandId : undefined,
    companyId:
      Number.isSafeInteger(companyId) && companyId > 0 ? companyId : undefined,
    divisionId:
      Number.isSafeInteger(divisionId) && divisionId > 0
        ? divisionId
        : undefined,
    locationId:
      Number.isSafeInteger(locationId) && locationId > 0
        ? locationId
        : undefined,
    status,
  };
  const canCreate = hasPermission(actor, PERMISSIONS.employeeCreate);
  const canEditProfiles =
    hasPermission(actor, PERMISSIONS.employeeUpdate) &&
    hasPermission(actor, PERMISSIONS.employeeViewPrivateFields);
  const canDeactivate = hasPermission(actor, PERMISSIONS.employeeDeactivate);
  const canViewLetters =
    hasPermission(actor, PERMISSIONS.letterView) &&
    (await isFeatureEnabled("letters"));
  const canCreateLetter =
    canViewLetters && hasPermission(actor, PERMISSIONS.letterCreate);
  const canExport = hasPermission(actor, PERMISSIONS.reportExport);
  const [
    employees,
    exitReasons,
    incompleteCount,
    brands,
    companies,
    divisions,
    locations,
  ] = await Promise.all([
    listEmployees(actor, search, incompleteOnly, page, PAGE_SIZE, filters),
    listExitReasons(),
    countIncompleteEmployees(actor),
    listBrandOptions(actor),
    listCompanyOptions(actor),
    listDivisionOptions(),
    listLocations(actor),
  ]);
  const queryValues: Record<string, string> = {
    ...(search ? { search } : {}),
    ...(filters.brandId ? { brand: String(filters.brandId) } : {}),
    ...(filters.companyId ? { company: String(filters.companyId) } : {}),
    ...(filters.divisionId ? { division: String(filters.divisionId) } : {}),
    ...(filters.locationId ? { location: String(filters.locationId) } : {}),
    ...(status ? { status } : {}),
    ...(incompleteOnly ? { incomplete: "1" } : {}),
  };
  const tabHref = (nextStatus?: string, incomplete = false) => {
    const q = new URLSearchParams(queryValues);
    q.delete("status");
    q.delete("incomplete");
    if (nextStatus) q.set("status", nextStatus);
    if (incomplete) q.set("incomplete", "1");
    return `/employees${q.size ? `?${q}` : ""}`;
  };
  const hasFilters = Object.keys(queryValues).length > 0;
  const filterCount = [
    filters.brandId,
    filters.companyId,
    filters.divisionId,
    filters.locationId,
  ].filter(Boolean).length;
  const rowActions = (employee: (typeof employees.employees)[number]) => (
    <EmployeeRowActions
      id={employee.id}
      name={employee.full_name}
      active={!!employee.is_active}
      canEdit={canEditProfiles}
      canCreateLetter={canCreateLetter}
      canViewLetters={canViewLetters}
      canDeactivate={canDeactivate}
      exitReasons={exitReasons.map((e) => ({ id: e.id, name: e.name }))}
      deactivateAction={deactivateEmployeeAction}
    />
  );
  const tenure = (months: number | null) =>
    months === null
      ? "Belum diisi"
      : `${Math.floor(months / 12)} tahun ${months % 12} bulan`;
  const tabs = [
    {
      label: "Semua karyawan",
      href: tabHref(),
      active: !status && !incompleteOnly,
    },
    {
      label: "Aktif",
      href: tabHref("active"),
      active: status === "active" && !incompleteOnly,
    },
    {
      label: "Nonaktif",
      href: tabHref("inactive"),
      active: status === "inactive" && !incompleteOnly,
    },
    {
      label: "Belum lengkap",
      href: tabHref(undefined, true),
      active: incompleteOnly,
    },
  ];
  const select = (
    name: string,
    label: string,
    value: number | undefined,
    options: { id: number; name: string }[],
  ) => (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">
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
        title="Data Karyawan"
        description="Kelola profil, penempatan, dan dokumen karyawan dalam satu tempat."
        action={
          canCreate ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/employees/import" className={buttonSecondary}>
                <Upload size={16} aria-hidden="true" />
                Impor karyawan
              </Link>
              <Link href="/employees/new" className={buttonPrimary}>
                <Plus size={17} aria-hidden="true" />
                Tambah karyawan
              </Link>
            </div>
          ) : undefined
        }
      />
      <FlashAlerts {...readFlash(params)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <span className="rounded-xl bg-brand-50 p-3 text-brand-700">
            <Users size={21} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">
              {hasFilters ? "Hasil pencarian & filter" : "Seluruh karyawan"}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {employees.total}
              <span className="ml-2 text-xs font-normal text-slate-500">
                karyawan
              </span>
            </p>
          </div>
        </div>
        <Link
          href="/employees?incomplete=1"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4 transition hover:bg-amber-50"
        >
          <div className="flex items-center gap-4">
            <span className="rounded-xl bg-white p-3 text-amber-700">
              <ClipboardCheck size={21} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-amber-800">
                Profil aktif perlu dilengkapi
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {incompleteCount}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  di seluruh brand yang dapat diakses
                </span>
              </p>
            </div>
          </div>
          <ArrowUpRight
            size={18}
            className="shrink-0 text-amber-700"
            aria-hidden="true"
          />
        </Link>
      </div>
      <Card>
        <CardBody>
          <Form action="/employees" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-1.5 text-xs font-semibold text-slate-600">
                Cari karyawan
                <div className="relative">
                  <Search
                    size={17}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    name="search"
                    defaultValue={search}
                    minLength={2}
                    maxLength={80}
                    placeholder="Nama atau kode karyawan"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </label>
              <SubmitButton className="sm:min-w-28" pendingLabel="Mencari...">
                Cari
              </SubmitButton>
              {hasFilters ? (
                <Link href="/employees" className={buttonSecondary}>
                  Hapus filter
                </Link>
              ) : null}
            </div>
            {status ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            {incompleteOnly ? (
              <input type="hidden" name="incomplete" value="1" />
            ) : null}
            <details
              open={filterCount > 0}
              className="group rounded-xl border border-slate-200 bg-slate-50/60"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
                Filter penempatan
                {filterCount
                  ? ` · ${filterCount} diterapkan`
                  : " · brand, perusahaan, divisi, lokasi"}
              </summary>
              <div className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-4">
                {select("brand", "Brand", filters.brandId, brands)}
                {select("company", "Perusahaan", filters.companyId, companies)}
                {select("division", "Divisi", filters.divisionId, divisions)}
                {select("location", "Lokasi", filters.locationId, locations)}
                <div className="sm:col-span-2 xl:col-span-4">
                  <button className={buttonSecondary}>Terapkan filter</button>
                </div>
              </div>
            </details>
          </Form>
        </CardBody>
      </Card>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 pt-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">
              Daftar karyawan
            </h2>
            {canExport ? (
              <Link
                href={`/api/reports/employees.pdf?${new URLSearchParams(queryValues)}`}
                className={buttonSecondary}
              >
                <Download size={16} aria-hidden="true" />
                Unduh PDF
              </Link>
            ) : null}
          </div>
          <nav
            aria-label="Status daftar karyawan"
            className="-mb-px flex gap-5 overflow-x-auto"
          >
            {tabs.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={`shrink-0 border-b-2 pb-3 text-sm font-semibold transition ${t.active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        {employees.employees.length === 0 ? (
          <CardBody>
            <EmptyState
              title={
                hasFilters
                  ? "Tidak ada karyawan yang sesuai"
                  : "Belum ada data karyawan"
              }
              description={
                hasFilters
                  ? "Coba kata kunci lain, ganti status, atau reset filter penempatan."
                  : "Tambahkan karyawan baru atau import data melalui Excel untuk memulai."
              }
            />
            {hasFilters ? (
              <div className="mt-4 text-center">
                <Link href="/employees" className={buttonSecondary}>
                  Tampilkan semua karyawan
                </Link>
              </div>
            ) : null}
          </CardBody>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {employees.employees.map((e) => (
                <article key={e.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/employees/${e.id}`}
                        className="break-words font-semibold text-slate-900"
                      >
                        {e.full_name}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {e.employee_code}
                      </p>
                    </div>
                    <Badge tone={e.is_active ? "success" : "neutral"}>
                      {e.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400">Jabatan / divisi</p>
                      <p className="mt-1 font-medium text-slate-700">
                        {e.position_name}
                      </p>
                      <p className="mt-0.5 text-slate-500">{e.division_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Brand / perusahaan</p>
                      <p className="mt-1 font-medium text-slate-700">
                        {e.brand_name}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        {e.company_name ?? "Belum dipilih"}
                      </p>
                    </div>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin size={13} aria-hidden="true" />
                    {e.location_name} · {tenure(e.service_months)}
                  </p>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    {e.is_profile_complete === 0 ? (
                      <Badge tone="warning">Profil belum lengkap</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Profil lengkap
                      </span>
                    )}
                    <div className="flex gap-2">
                      <Link
                        href={`/employees/${e.id}`}
                        className={buttonSecondary}
                      >
                        Detail
                      </Link>
                      {rowActions(e)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-50/80 text-xs text-slate-500">
                  <tr>
                    {[
                      "Karyawan",
                      "Jabatan / divisi",
                      "Penempatan",
                      "Masa kerja",
                      "Aksi",
                    ].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className={`px-5 py-3.5 font-semibold ${h === "Aksi" ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.employees.map((e) => (
                    <tr
                      key={e.id}
                      className="align-top transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex gap-3">
                          <span
                            aria-hidden="true"
                            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700"
                          >
                            {e.full_name
                              .trim()
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/employees/${e.id}`}
                              className="font-semibold text-slate-900 hover:text-brand-700"
                            >
                              {e.full_name}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {e.employee_code}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Badge tone={e.is_active ? "success" : "neutral"}>
                                {e.is_active ? "Aktif" : "Nonaktif"}
                              </Badge>
                              {e.is_profile_complete === 0 ? (
                                <Badge tone="warning">Belum lengkap</Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-800">
                          {e.position_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {e.division_name}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-800">
                          {e.brand_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {e.company_name ?? "Perusahaan belum dipilih"}
                        </p>
                        <p className="mt-2 flex items-start gap-1 text-xs text-slate-500">
                          <MapPin
                            size={12}
                            className="mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          {e.location_name}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">
                        {tenure(e.service_months)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/employees/${e.id}`}
                            className={buttonSecondary}
                          >
                            Detail
                          </Link>
                          {rowActions(e)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="border-t border-slate-100 px-4 py-2 sm:px-5">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={employees.total}
            basePath="/employees"
            query={queryValues}
          />
        </div>
      </Card>
    </div>
  );
}
