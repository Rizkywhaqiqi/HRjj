import { SubmitButton } from "@/components/ui/form";
import Form from "next/form";
import { formatDate } from "@/components/shared/format";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  CircleAlert,
  Clock3,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import OrganizationFilters from "./organization-filters";
import Link from "next/link";
import { requirePermission, requireFeatureEnabled } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { financeDirectory } from "@/modules/finance/queries";
import { money } from "@/modules/finance/policy";
import {
  listBrandOptions,
  listCompanyOptions,
  listLocations,
} from "@/modules/master-data";
import { Pagination, parsePage } from "@/components/shared/pagination";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Badge,
  EmptyState,
  inputClass,
  buttonSecondary,
} from "@/components/ui/primitives";
export const instant = false;
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.financeView);
  await requireFeatureEnabled("employees");
  const raw = await searchParams;
  const [data, brands, companies, locations] = await Promise.all([
    financeDirectory(actor, raw, parsePage(raw.page)),
    listBrandOptions(actor),
    listCompanyOptions(actor),
    listLocations(actor),
  ]);
  const query = Object.fromEntries(
    Object.entries(raw).filter(
      ([k, v]) =>
        [
          "month",
          "brand",
          "company",
          "location",
          "search",
          "status",
          "task",
        ].includes(k) && typeof v === "string",
    ),
  ) as Record<string, string>;
  query.month = data.period.month;
  const periodLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${data.period.start}T00:00:00Z`));
  const selectedTask = typeof raw.task === "string" ? raw.task : "";
  const taskLabels: Record<string, string> = {
    incomplete: "Data belum lengkap",
    unverified: "Belum diverifikasi",
    pending: "Menunggu keputusan gaji",
  };
  const taskLabel = Object.hasOwn(taskLabels, selectedTask)
    ? taskLabels[selectedTask]
    : undefined;
  const stats = [
    {
      label: "Karyawan",
      value: data.summary.total,
      task: "",
      icon: Users,
      hint: "Dalam pilihan saat ini",
    },
    {
      label: "Belum lengkap",
      value: data.summary.incomplete,
      task: "incomplete",
      icon: CircleAlert,
      hint: "Lengkapi data administrasi",
    },
    {
      label: "Perlu verifikasi",
      value: data.summary.unverified,
      task: "unverified",
      icon: CheckCheck,
      hint: "Periksa kelengkapan data",
    },
    {
      label: "Pengajuan gaji",
      value: data.summary.pending,
      task: "pending",
      icon: Clock3,
      hint: "Menunggu keputusan",
    },
  ];
  return (
    <div className="finance-workspace space-y-5">
      <PageHeader
        title="Data Gaji Karyawan"
        description="Pilih karyawan untuk melihat profil gaji atau mengajukan perubahan."
        action={
          <div className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            <CalendarDays size={16} aria-hidden="true" />
            {periodLabel}
          </div>
        }
      />
      <FlashAlerts {...readFlash(raw)} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map(({ label, value, task, icon: Icon, hint }) => (
          <Link
            key={task}
            href={`/finance?${new URLSearchParams({ ...query, task })}`}
            aria-current={selectedTask === task ? "page" : undefined}
            className={`group min-w-0 rounded-2xl border bg-white p-4 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:p-5 ${selectedTask === task ? "border-brand-500 ring-1 ring-brand-500/10" : "border-slate-200 hover:border-brand-300"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 sm:text-sm">
                {label}
              </span>
              <Icon
                aria-hidden="true"
                size={17}
                className={
                  Number(value) > 0 && task
                    ? "shrink-0 text-amber-600"
                    : "shrink-0 text-slate-400"
                }
              />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {Number(value).toLocaleString("id-ID")}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs leading-5 text-slate-500">{hint}</p>
              <ArrowUpRight
                size={14}
                aria-hidden="true"
                className="shrink-0 text-slate-400 group-hover:text-brand-700"
              />
            </div>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader
          title="Cari dan filter karyawan"
          description="Sesuaikan periode dan cakupan data yang ingin diperiksa."
        />
        <CardBody>
          <Form
            action="/finance"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <label className="grid gap-1.5 text-sm font-medium text-slate-600">
              Periode
              <input
                className={inputClass}
                type="month"
                name="month"
                min="2000-01"
                max="2100-12"
                defaultValue={data.period.month}
              />
            </label>
            <OrganizationFilters
              key={JSON.stringify(query)}
              brands={brands}
              companies={companies}
              locations={locations}
              initialBrand={typeof raw.brand === "string" ? raw.brand : ""}
              initialCompany={
                typeof raw.company === "string" ? raw.company : ""
              }
              initialLocation={
                typeof raw.location === "string" ? raw.location : ""
              }
            />
            <label className="grid gap-1.5 text-sm font-medium text-slate-600">
              Nama / kode
              <input
                className={inputClass}
                placeholder="Nama atau kode karyawan"
                type="search"
                name="search"
                maxLength={80}
                defaultValue={typeof raw.search === "string" ? raw.search : ""}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-600">
              Status kerja saat ini
              <select
                className={inputClass}
                name="status"
                defaultValue={
                  typeof raw.status === "string" ? raw.status : "active"
                }
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
                <option value="all">Semua</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-3">
              <SubmitButton pendingLabel="Menerapkan filter...">
                <Search size={16} aria-hidden="true" />
                Terapkan filter
              </SubmitButton>
              <Link href="/finance" className={buttonSecondary}>
                Hapus filter
              </Link>
            </div>
          </Form>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
            Gaji mengikuti akhir periode. Penempatan dan kelengkapan mengikuti
            profil saat ini.
          </p>
        </CardBody>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm">
        <p className="text-brand-900">
          <span className="font-semibold">
            {Number(data.summary.changed)} karyawan
          </span>{" "}
          memiliki perubahan gaji disetujui yang berlaku pada {periodLabel}.
        </p>
        <span className="text-xs text-brand-700">Persiapan penggajian</span>
      </div>
      <Card>
        <CardHeader
          title="Daftar karyawan dan gaji"
          description={`${data.total} karyawan · ${periodLabel}`}
        />
        <CardBody>
          {taskLabel ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 font-medium text-slate-700">
                <SlidersHorizontal size={14} aria-hidden="true" />
                {taskLabel}
              </span>
              <Link
                className="min-h-11 content-center font-semibold text-brand-700 hover:underline"
                href={`/finance?${new URLSearchParams({ ...query, task: "" })}`}
              >
                Hapus pilihan
              </Link>
            </div>
          ) : null}
          {data.rows.length ? (
            <div className="responsive-table-wrap overflow-x-auto">
              <table className="responsive-data-table w-full table-fixed min-w-[980px] text-left text-sm">
                <caption className="sr-only">
                  Data karyawan, penempatan dan gaji pada periode terpilih
                </caption>
                <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {[
                      "Karyawan",
                      "CV / Brand",
                      "Outlet / Jabatan",
                      "Jenis karyawan",
                      "Gaji akhir periode",
                      "Perubahan",
                      "Pemeriksaan",
                    ].map((s) => (
                      <th
                        key={s}
                        scope="col"
                        className="px-3 py-3 font-semibold"
                      >
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-slate-100 align-top transition hover:bg-slate-50/70"
                    >
                      <td className="px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Karyawan
                        </span>
                        <Link
                          className="break-words font-semibold text-slate-900 decoration-brand-300 underline-offset-4 hover:text-brand-700 hover:underline"
                          href={`/finance/employees/${e.id}`}
                        >
                          {e.full_name}
                          <span className="mt-1 block text-xs font-medium text-brand-700">Lihat profil gaji</span>
                        </Link>
                        <p className="text-xs text-slate-500">
                          {e.employee_code} ·{" "}
                          {e.is_active ? "Aktif" : "Nonaktif"}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          CV / Brand
                        </span>
                        {e.company_name ?? "CV belum ditentukan"}
                        <p className="text-xs text-slate-500">{e.brand_name}</p>
                      </td>
                      <td className="px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Outlet / Jabatan
                        </span>
                        {e.location_name}
                        <p className="text-xs text-slate-500">
                          {e.position_name}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Jenis karyawan
                        </span>
                        {e.employment_type ?? "Belum ditentukan"}
                      </td>
                      <td className="px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Gaji akhir periode
                        </span>
                        <span className="font-semibold tabular-nums text-slate-900">
                          {money(e.amount)}
                        </span>
                      </td>
                      <td className="space-y-1.5 px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Perubahan
                        </span>
                        {Boolean(e.pending) && (
                          <Badge tone="warning">Menunggu keputusan</Badge>
                        )}
                        {Boolean(e.changed) && (
                          <Badge tone="neutral">Berlaku periode ini</Badge>
                        )}
                        {e.future_date && (
                          <p className="text-xs">
                            Terjadwal {formatDate(e.future_date)}: {money(e.future_amount)}
                          </p>
                        )}
                        {!e.pending && !e.changed && !e.future_date
                          ? "—"
                          : null}
                      </td>
                      <td className="px-3 py-4">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Pemeriksaan
                        </span>
                        <Badge
                          tone={
                            !e.ready
                              ? "warning"
                              : e.verified
                                ? "success"
                                : "neutral"
                          }
                        >
                          {!e.ready
                            ? "Data belum lengkap"
                            : e.verified
                              ? "Terverifikasi"
                              : "Perlu verifikasi"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Tidak ada karyawan sesuai filter"
              description="Ubah pencarian atau pilihan organisasi."
            />
          )}
          <details className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <summary className="min-h-11 cursor-pointer content-center font-medium text-slate-700">
              Panduan pemeriksaan data dan gaji
            </summary>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-xs leading-5">
              <li>
                Lengkapi CV, tanggal masuk, NIK, bank, dan rekening sebelum
                verifikasi.
              </li>
              <li>
                Pengajuan gaji diputuskan oleh pengguna lain yang berwenang.
              </li>
              <li>
                Gaji pokok di akhir periode belum mencakup prorata, rapel,
                potongan, pajak, atau pembayaran.
              </li>
            </ul>
          </details>
          <Pagination
            basePath="/finance"
            page={data.page}
            pageSize={25}
            total={data.total}
            query={query}
          />
        </CardBody>
      </Card>
    </div>
  );
}
