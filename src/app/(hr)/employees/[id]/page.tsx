import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  hasPermission,
  requireFeatureEnabled,
  requirePermission,
} from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  getEmployeeDetailSummary,
  getEmployeeForEdit,
  updateEmployeeAction,
} from "@/modules/employees";
import {
  listCompanyOptions,
  listPositionOptions,
  listLocations,
} from "@/modules/master-data";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  inputClass,
  buttonPrimary,
  buttonSecondary,
} from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import { formatDate, firstParam } from "@/components/shared/format";

export const instant = false;

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">
        {value || "—"}
      </dd>
    </div>
  );
}

function maritalStatusLabel(
  value: "SINGLE" | "MARRIED" | "DIVORCED" | null,
): string {
  return value
    ? { SINGLE: "Belum menikah", MARRIED: "Menikah", DIVORCED: "Cerai" }[value]
    : "—";
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.employeeView);
  await requireFeatureEnabled("employees");
  const [{ id: rawId }, query] = await Promise.all([params, searchParams]);
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const summary = await getEmployeeDetailSummary(actor, id);
  if (!summary) notFound();

  const canViewPrivate = hasPermission(
    actor,
    PERMISSIONS.employeeViewPrivateFields,
  );
  const canViewSensitive = hasPermission(
    actor,
    PERMISSIONS.employeeViewSensitive,
  );
  const canEdit =
    canViewPrivate && hasPermission(actor, PERMISSIONS.employeeUpdate);
  const isEditing = canEdit && firstParam(query.mode) === "edit";
  const [employee, paramsValue] = await Promise.all([
    canViewPrivate ? getEmployeeForEdit(actor, id) : Promise.resolve(null),
    Promise.resolve(query),
  ]);
  if (canViewPrivate && !employee) notFound();

  if (isEditing && employee) {
    const [companies, positions, locations] = await Promise.all([
      listCompanyOptions(actor),
      listPositionOptions(),
      listLocations(actor),
    ]);

    return (
      <div>
        <PageHeader
          title={`Edit karyawan: ${summary.full_name}`}
          description="Perubahan dicatat ke audit log dan tetap mengikuti scope brand."
          action={
            <Link href={`/employees/${id}`} className={buttonSecondary}>
              Kembali ke detail
            </Link>
          }
        />
        <FlashAlerts {...readFlash(paramsValue)} />
        <Card>
          <CardHeader
            title="Data karyawan"
            description="Periksa kembali data sebelum menyimpan perubahan."
          />
          <CardBody>
            <form
              action={updateEmployeeAction}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              <input type="hidden" name="employeeId" value={employee.id} />
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Kode karyawan
                <input
                  name="employeeCode"
                  required
                  defaultValue={employee.employee_code}
                  placeholder="Kode karyawan"
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Nama lengkap
                <input
                  name="fullName"
                  required
                  defaultValue={employee.full_name}
                  placeholder="Nama lengkap"
                  className={inputClass}
                />
              </label>
              {canViewSensitive ? (
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  NIK (bisa dilengkapi nanti)
                  <input
                    name="nik"
                    defaultValue={employee.nik ?? ""}
                    pattern="[0-9]{16}"
                    placeholder="NIK (bisa dilengkapi nanti)"
                    className={inputClass}
                  />
                </label>
              ) : (
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  NIK hanya dapat dilihat dan diubah dengan izin data sensitif.
                </p>
              )}
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Tempat lahir
                <input
                  name="birthPlace"
                  defaultValue={employee.birth_place ?? ""}
                  placeholder="Tempat lahir"
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Tanggal lahir
                <input
                  name="birthDate"
                  type="date"
                  defaultValue={employee.birth_date ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Telepon
                <input
                  name="phone"
                  defaultValue={employee.phone ?? ""}
                  placeholder="Telepon"
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={employee.email ?? ""}
                  placeholder="Email"
                  className={inputClass}
                />
              </label>
              {canViewSensitive ? (
                <>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    NPWP
                    <input
                      name="npwp"
                      defaultValue={employee.npwp ?? ""}
                      placeholder="NPWP"
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Nama bank
                    <input
                      name="bankName"
                      defaultValue={employee.bank_name ?? ""}
                      placeholder="Nama bank"
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    No. rekening
                    <input
                      name="bankAccountNumber"
                      defaultValue={employee.bankAccountNumber ?? ""}
                      placeholder="No. rekening"
                      className={inputClass}
                    />
                  </label>
                </>
              ) : (
                <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
                  NPWP dan rekening hanya dapat dikelola dengan izin data
                  sensitif.
                </p>
              )}
              <textarea
                name="addressCurrent"
                defaultValue={employee.address_current ?? ""}
                placeholder="Alamat domisili"
                className={`${inputClass} sm:col-span-2`}
              />
              <textarea
                name="addressKtp"
                defaultValue={employee.address_ktp ?? ""}
                placeholder="Alamat KTP"
                className={`${inputClass} sm:col-span-2`}
              />
              <label className="text-sm text-slate-600">
                Ganti foto KTP (maksimal 1,5 MB)
                <input
                  name="ktpPhoto"
                  type="file"
                  accept="image/jpeg,image/png"
                  className="mt-2 block w-full text-sm"
                />
              </label>
              <select
                name="companyId"
                defaultValue={employee.company_id ?? ""}
                className={inputClass}
              >
                <option value="">CV belum dipilih</option>
                {companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                name="positionId"
                required
                defaultValue={employee.position_id}
                className={inputClass}
              >
                <option value="">Jabatan</option>
                {positions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                name="locationId"
                required
                defaultValue={employee.location_id}
                className={inputClass}
              >
                <option value="">Lokasi</option>
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                name="maritalStatus"
                defaultValue={employee.marital_status ?? ""}
                className={inputClass}
              >
                <option value="">Status pernikahan belum diisi</option>
                <option value="SINGLE">Belum menikah</option>
                <option value="MARRIED">Menikah</option>
                <option value="DIVORCED">Cerai</option>
              </select>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Jumlah anak
                <input
                  name="childrenCount"
                  type="number"
                  min="0"
                  max="30"
                  defaultValue={employee.children_count ?? ""}
                  placeholder="Jumlah anak"
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Tanggal bergabung
                <input
                  name="joinDate"
                  type="date"
                  defaultValue={employee.join_date ?? ""}
                  className={inputClass}
                />
              </label>
              <button
                className={`${buttonPrimary} sm:col-span-2 lg:col-span-3`}
              >
                Simpan progres
              </button>
            </form>
          </CardBody>
        </Card>
      </div>
    );
  }

  const serviceYears =
    summary.service_months === null
      ? null
      : Math.floor(summary.service_months / 12);
  const serviceMonths =
    summary.service_months === null ? null : summary.service_months % 12;

  return (
    <div>
      <PageHeader
        title={summary.full_name}
        description={`Profil karyawan · ${summary.employee_code}${summary.is_profile_complete === 0 ? " · Data belum lengkap" : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/employees" className={buttonSecondary}>
              Daftar karyawan
            </Link>
            {canEdit ? (
              <Link
                href={`/employees/${id}?mode=edit`}
                className={buttonPrimary}
              >
                {summary.is_profile_complete === 0
                  ? "Lengkapi data"
                  : "Edit data"}
              </Link>
            ) : null}
          </div>
        }
      />
      <FlashAlerts {...readFlash(paramsValue)} />
      <Card className="mb-5 overflow-hidden">
        <div className="bg-gradient-to-r from-brand-700 to-brand-600 px-5 py-5 text-white sm:px-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-white/75">Ringkasan pekerjaan</p>
              <h2 className="mt-1 text-xl font-semibold">
                {summary.position_name}
              </h2>
              <p className="mt-1 text-sm text-white/85">
                {summary.division_name} ·{" "}
                {summary.company_name ?? "CV belum dipilih"}
              </p>
            </div>
            <Badge tone={summary.is_active ? "success" : "neutral"}>
              {summary.is_active ? "Karyawan aktif" : "Karyawan nonaktif"}
            </Badge>
            {summary.is_profile_complete === 0 ? (
              <Badge tone="warning">Data belum lengkap</Badge>
            ) : null}
          </div>
        </div>
        <CardBody>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label="Kode karyawan" value={summary.employee_code} />
            <DetailField label="Brand" value={summary.brand_name} />
            <DetailField
              label="Lokasi kerja"
              value={[summary.location_name, summary.location_city]
                .filter(Boolean)
                .join(" · ")}
            />
            <DetailField
              label="Masa kerja"
              value={
                serviceYears === null
                  ? "Belum diisi"
                  : `${serviceYears} tahun ${serviceMonths} bulan`
              }
            />
            <DetailField
              label="Tanggal mulai kerja"
              value={formatDate(summary.join_date)}
            />
            {summary.is_active ? null : (
              <DetailField
                label="Tanggal keluar"
                value={formatDate(summary.exit_date)}
              />
            )}
            {summary.is_active ? null : (
              <DetailField
                label="Alasan keluar"
                value={summary.exit_reason_name}
              />
            )}
          </dl>
        </CardBody>
      </Card>

      {canViewPrivate && employee ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Informasi pribadi"
              description="Data ini hanya ditampilkan untuk pengguna dengan izin data pribadi."
            />
            <CardBody>
              <dl className="grid gap-5 sm:grid-cols-2">
                <DetailField
                  label="Tempat lahir"
                  value={employee.birth_place}
                />
                <DetailField
                  label="Tanggal lahir"
                  value={formatDate(employee.birth_date)}
                />
                <DetailField label="Email" value={employee.email} />
                <DetailField label="Nomor telepon" value={employee.phone} />
                <DetailField
                  label="Status pernikahan"
                  value={maritalStatusLabel(employee.marital_status)}
                />
                <DetailField
                  label="Jumlah anak"
                  value={
                    employee.children_count === null
                      ? null
                      : String(employee.children_count)
                  }
                />
                <DetailField
                  label="Alamat domisili"
                  value={employee.address_current}
                />
                <DetailField label="Alamat KTP" value={employee.address_ktp} />
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Data sensitif"
              description="NIK, NPWP, dan rekening mengikuti izin khusus."
            />
            <CardBody>
              {canViewSensitive ? (
                <dl className="grid gap-5 sm:grid-cols-2">
                  <DetailField label="NIK" value={employee.nik} />
                  <DetailField
                    label="Foto KTP"
                    value={
                      employee.ktp_photo_path ? (
                        <a
                          href={`/api/files/ktp/${id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonSecondary}
                        >
                          Lihat KTP
                        </a>
                      ) : (
                        "Belum diunggah"
                      )
                    }
                  />
                  <DetailField label="NPWP" value={employee.npwp} />
                  <DetailField label="Nama bank" value={employee.bank_name} />
                  <DetailField
                    label="Nomor rekening"
                    value={employee.bankAccountNumber}
                  />
                </dl>
              ) : (
                <Alert tone="info">
                  Anda tidak memiliki izin untuk melihat NIK, NPWP, dan nomor
                  rekening.
                </Alert>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader title="Informasi pribadi" />
          <CardBody>
            <Alert tone="info">
              Data pribadi tidak ditampilkan. Minta izin
              `employee.view_private_fields` untuk melihat detail ini.
            </Alert>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
