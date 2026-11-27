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
  buttonPrimary,
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
      ([k, v]) => k !== "page" && typeof v === "string",
    ),
  ) as Record<string, string>;
  query.month = data.period.month;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Keuangan karyawan"
        description="Periksa data dan riwayat gaji sebelum menyiapkan penggajian."
      />
      <FlashAlerts {...readFlash(raw)} />
      <Card>
        <CardBody>
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
          >
            <label className="grid gap-1 text-sm">
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
            <OrganizationFilters key={JSON.stringify(query)} brands={brands} companies={companies} locations={locations} initialBrand={typeof raw.brand==='string'?raw.brand:''} initialCompany={typeof raw.company==='string'?raw.company:''} initialLocation={typeof raw.location==='string'?raw.location:''}/>
            <label className="grid gap-1 text-sm">
              Nama / kode
              <input
                className={inputClass}
                name="search"
                maxLength={80}
                defaultValue={typeof raw.search === "string" ? raw.search : ""}
              />
            </label>
            <label className="grid gap-1 text-sm">Status kerja saat ini<select className={inputClass} name="status" defaultValue={typeof raw.status==='string'?raw.status:'active'}><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="all">Semua</option></select></label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-5">
              <button className={buttonPrimary}>Tampilkan periode</button>
              <Link href="/finance" className="text-sm underline">
                Reset
              </Link>
            </div>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Gaji ditampilkan pada akhir periode. CV, brand, outlet, kelengkapan,
            dan filter mengikuti profil saat ini. Ini daftar persiapan, bukan
            hasil payroll atau bukti pembayaran.
          </p>
        </CardBody>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Karyawan dalam filter", data.summary.total, ""],
          ["Data belum lengkap", data.summary.incomplete, "incomplete"],
          ["Belum diverifikasi", data.summary.unverified, "unverified"],
          ["Menunggu keputusan gaji", data.summary.pending, "pending"],
        ].map(([label, value, task]) => (
          <Card key={String(label)}>
            <CardBody>
              <Link
                className="block rounded-lg focus-visible:outline-2"
                href={`/finance?${new URLSearchParams({ ...query, task: String(task) })}`}
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{Number(value)}</p>
                <p className="mt-1 text-xs text-brand-700">Lihat daftar →</p>
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader
          title="Perlu ditindaklanjuti"
          description={`${Number(data.summary.changed)} karyawan memiliki gaji disetujui yang mulai berlaku pada periode ini.`}
        />
        <CardBody>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>
              Lengkapi CV, tanggal masuk, NIK, bank, dan rekening sebelum
              verifikasi.
            </li>
            <li>
              Pengajuan gaji harus diputuskan pengguna lain yang memiliki izin
              persetujuan.
            </li>
            <li>
              Perubahan berlaku surut perlu diperiksa untuk rapel; aplikasi
              belum menghitung atau membayarkan selisih otomatis.
            </li>
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Daftar karyawan dan gaji"
          description={`${data.total} karyawan · 25 data per halaman · ${data.period.month}`}
        />
        <CardBody>
          {data.rows.length ? (
            <div className="responsive-table-wrap overflow-x-auto">
              <table className="responsive-data-table w-full table-fixed min-w-[900px] text-left text-sm">
                <thead>
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
                      <th key={s} className="p-3">
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="p-3">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Karyawan
                        </span>
                        <Link
                          className="break-words font-semibold text-brand-700 underline"
                          href={`/finance/employees/${e.id}`}
                        >
                          {e.full_name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {e.employee_code} ·{" "}
                          {e.is_active ? "Aktif" : "Nonaktif"}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="mobile-cell-label" aria-hidden="true">
                          CV / Brand
                        </span>
                        {e.company_name ?? "CV belum ditentukan"}
                        <p className="text-xs text-slate-500">{e.brand_name}</p>
                      </td>
                      <td className="p-3">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Outlet / Jabatan
                        </span>
                        {e.location_name}
                        <p className="text-xs text-slate-500">
                          {e.position_name}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Jenis karyawan
                        </span>
                        {e.employment_type ?? "Belum ditentukan"}
                      </td>
                      <td className="p-3">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Gaji akhir periode
                        </span>
                        {money(e.amount)}
                      </td>
                      <td className="space-y-1 p-3">
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
                            Terjadwal {e.future_date}: {money(e.future_amount)}
                          </p>
                        )}
                        {!e.pending && !e.changed && !e.future_date
                          ? "—"
                          : null}
                      </td>
                      <td className="p-3">
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
