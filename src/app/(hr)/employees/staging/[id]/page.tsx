import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Field,
  inputClass,
  PageHeader,
  buttonPrimary,
  buttonSecondary,
} from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  getPendingEmployeeStagingDetail,
  promoteEmployeeStagingAction,
  saveEmployeeStagingProgressAction,
} from "@/modules/employees";
import {
  listCompanyOptions,
  listDivisionOptions,
  listLocations,
  listPositionOptions,
} from "@/modules/master-data";

export const instant = false;

const REVIEW_LABELS: Record<string, string> = {
  CANDIDATE_DATA: "Berasal dari kandidat diterima",
  COMPANY_MAPPING_PENDING: "Perusahaan belum dipetakan",
  POSITION_MAPPING_PENDING: "Jabatan belum dipetakan",
  LOCATION_MAPPING_PENDING: "Lokasi menunggu pemetaan",
  NIK_MISSING: "NIK belum tersedia di sumber",
  NIK_NUMERIC_EXCEL_REVIEW: "NIK tersimpan sebagai angka; isi ulang dengan NIK terverifikasi",
  NIK_INVALID_FORMAT: "Format NIK sumber perlu diperiksa",
  NIK_DUPLICATE_IN_SOURCE: "NIK sumber terduplikasi",
  NIK_ALREADY_IN_EMPLOYEE_TABLE: "NIK mungkin sudah tercatat sebagai karyawan",
  FORMULA_CELL_REVIEW: "Sumber berisi sel formula",
};

function getId(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("id-ID");
}

export default async function EmployeeStagingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.employeeCreate);
  await requireFeatureEnabled("employees");
  const { id } = await params;
  const stagingId = getId(id);
  if (!stagingId) notFound();

  const [detail, companies, divisions, positions, locations, search] =
    await Promise.all([
      getPendingEmployeeStagingDetail(actor, stagingId),
      listCompanyOptions(actor),
      listDivisionOptions(),
      listPositionOptions(),
      listLocations(actor, true),
      searchParams,
    ]);
  if (!detail) notFound();

  const paramsValue = await search;
  const exactPositions = positions.filter(
    (item) => normalized(item.name) === normalized(detail.source.position),
  );
  const exactLocations = locations.filter(
    (item) => normalized(item.name) === normalized(detail.source.location),
  );
  const savedPositionId = getId(detail.completion.positionId);
  const savedLocationId = getId(detail.completion.locationId);
  const positionId =
    detail.completion.positionId ||
    (exactPositions.length === 1 ? String(exactPositions[0].id) : "");
  const locationId =
    detail.completion.locationId ||
    (exactLocations.length === 1 ? String(exactLocations[0].id) : "");
  const flash = readFlash(paramsValue);

  return (
    <div>
      <PageHeader
        title="Lengkapi data karyawan"
        description={`Data kandidat dari lamaran #${detail.application_id}. Nama dan penempatan kerja wajib dipilih; data lainnya boleh dilengkapi kapan saja, termasuk setelah karyawan aktif.`}
        action={
          <Link href="/employees/staging" className={buttonSecondary}>
            Kembali ke staging
          </Link>
        }
      />
      <FlashAlerts {...flash} />

      <Card className="mb-5">
        <CardHeader
          title="Catatan sumber"
          description="Data ini disalin dari profil kandidat. Periksa nilai yang tersedia; data yang kosong bisa dilengkapi setelah karyawan aktif."
        />
        <CardBody>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Tempat/tanggal lahir sumber</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-800">
                {detail.source.birthDetails || "Belum tersedia"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Jabatan sumber</dt>
              <dd className="mt-1 text-slate-800">
                {detail.source.position || "Belum tersedia"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Penempatan sumber</dt>
              <dd className="mt-1 text-slate-800">
                {detail.source.location || "Belum tersedia"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Tanggal bergabung sumber</dt>
              <dd className="mt-1 text-slate-800">
                {detail.source.joinDate || "Belum tersedia"}
              </dd>
            </div>
          </dl>
          {detail.review_flags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {detail.review_flags.map((flag) => (
                <Badge key={flag} tone="warning">
                  {REVIEW_LABELS[flag] ?? "Perlu ditinjau"}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <form action={promoteEmployeeStagingAction} className="grid gap-5">
        <input type="hidden" name="stagingId" value={detail.id} />
        <Card>
          <CardHeader
            title="Data pribadi dan pekerjaan"
            description="Data kandidat terisi otomatis. Lengkapi bagian yang masih kosong sebelum mengaktifkan data karyawan."
          />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Nama lengkap">
                <input
                  name="fullName"
                  defaultValue={detail.completion.fullName}
                  required
                  minLength={2}
                  maxLength={150}
                  className={inputClass}
                />
              </Field>
              <Field label="NIK (16 digit)">
                <input
                  name="nik"
                  defaultValue={detail.completion.nik}
                  inputMode="numeric"
                  pattern="[0-9]{16}"
                  maxLength={16}
                  className={inputClass}
                />
              </Field>
              <Field label="Tempat lahir">
                <input
                  name="birthPlace"
                  defaultValue={detail.completion.birthPlace}
                  maxLength={100}
                  className={inputClass}
                />
              </Field>
              <Field label="Tanggal lahir">
                <input
                  name="birthDate"
                  type="date"
                  defaultValue={detail.completion.birthDate}
                  className={inputClass}
                />
              </Field>
              <Field label="Tanggal mulai bekerja">
                <input
                  name="joinDate"
                  type="date"
                  defaultValue={detail.completion.joinDate}
                  className={inputClass}
                />
              </Field>
              <Field label="Email (opsional)">
                <input
                  name="email"
                  type="email"
                  defaultValue={detail.completion.email}
                  maxLength={150}
                  className={inputClass}
                />
              </Field>
              <Field label="Nomor telepon">
                <input
                  name="phone"
                  defaultValue={detail.completion.phone}
                  maxLength={30}
                  className={inputClass}
                />
              </Field>
              <Field label="Status pernikahan">
                <select
                  name="maritalStatus"
                  defaultValue={detail.completion.maritalStatus}
                  className={inputClass}
                >
                  <option value="">Belum diisi</option>
                  <option value="SINGLE">Belum menikah</option>
                  <option value="MARRIED">Menikah</option>
                  <option value="DIVORCED">Cerai</option>
                </select>
              </Field>
              <Field label="Jumlah anak">
                <input
                  name="childrenCount"
                  type="number"
                  min={0}
                  max={30}
                  defaultValue={detail.completion.childrenCount}
                  className={inputClass}
                />
              </Field>
              <p className="self-center text-sm text-slate-600">
                ID karyawan dibuat otomatis saat data dijadikan karyawan aktif.
              </p>
              <Field label="CV/perusahaan">
                <select
                  name="companyId"
                  defaultValue={detail.completion.companyId}
                  required
                  className={inputClass}
                >
                  <option value="">Pilih perusahaan</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Jabatan">
                <select
                  name="positionId"
                  defaultValue={savedPositionId ? String(savedPositionId) : positionId}
                  required
                  className={inputClass}
                >
                  <option value="">Pilih jabatan</option>
                  {positions.map((position) => {
                    const division = divisions.find(
                      (item) => item.id === position.parentId,
                    );
                    return (
                      <option key={position.id} value={position.id}>
                        {position.name}{division ? ` — ${division.name}` : ""}
                      </option>
                    );
                  })}
                </select>
              </Field>
              <Field
                label="Lokasi"
                hint="Lokasi staging yang belum aktif akan diaktifkan saat karyawan dibuat."
              >
                <select
                  name="locationId"
                  defaultValue={savedLocationId ? String(savedLocationId) : locationId}
                  required
                  className={inputClass}
                >
                  <option value="">Pilih lokasi</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                      {!location.is_active ? " (belum aktif)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Alamat domisili" className="md:col-span-2">
                <textarea
                  name="addressCurrent"
                  defaultValue={detail.completion.addressCurrent}
                  maxLength={2000}
                  rows={3}
                  className={inputClass}
                />
              </Field>
              <Field label="Alamat sesuai KTP" className="md:col-span-2">
                <textarea
                  name="addressKtp"
                  defaultValue={detail.completion.addressKtp}
                  maxLength={2000}
                  rows={3}
                  className={inputClass}
                />
              </Field>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="submit"
            formAction={saveEmployeeStagingProgressAction}
            formNoValidate
            className={buttonSecondary}
          >
            Simpan progres
          </button>
          <button type="submit" className={buttonPrimary}>
            Aktifkan sebagai karyawan
          </button>
        </div>
      </form>
    </div>
  );
}
