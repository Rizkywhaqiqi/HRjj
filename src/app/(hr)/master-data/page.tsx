import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { hasPermission, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  createBrandAction,
  createCompanyAction,
  createContractTypeAction,
  createDivisionAction,
  createExitReasonAction,
  createLocationAction,
  createPositionAction,
  updateBrandAction,
  updateCompanyAction,
  updateContractTypeAction,
  updateDivisionAction,
  updateExitReasonAction,
  updateLocationAction,
  updatePositionAction,
  setMasterDataActiveAction,
  deleteMasterDataAction,
} from "@/modules/master-data/actions";
import {
  listBrandOptions,
  listBrands,
  listCompanies,
  listContractTypes,
  listDivisionOptions,
  listDivisions,
  listExitReasons,
  listLocations,
  listPositions,
} from "@/modules/master-data";
import { PageHeader, Badge, inputClass, buttonPrimary, buttonDanger } from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";

export const instant = false;

function TextInput({
  name,
  placeholder,
  type = "text",
  defaultValue,
  required = false,
}: {
  name: string;
  placeholder: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
}) {
  return <input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} className={inputClass} />;
}

function Submit({ children = "Tambah" }: { children?: string }) {
  return <button type="submit" className={buttonPrimary}>{children}</button>;
}

function RecordActions({
  entity,
  id,
  isActive,
  editForm,
}: {
  entity: string;
  id: number;
  isActive: 0 | 1;
  editForm: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <details className="relative">
        <summary className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          Edit
        </summary>
        <div className="absolute right-0 z-10 mt-2 w-[min(90vw,28rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          {editForm}
        </div>
      </details>
      <form action={setMasterDataActiveAction}>
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="nextActive" value={isActive ? "0" : "1"} />
        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          {isActive ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </form>
      <details>
        <summary className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">
          Hapus
        </summary>
        <form action={deleteMasterDataAction} className="mt-2 grid min-w-48 gap-2 rounded-xl border border-rose-200 bg-white p-3 shadow-sm">
          <input type="hidden" name="entity" value={entity} />
          <input type="hidden" name="id" value={id} />
          <p className="text-xs leading-5 text-slate-600">Hapus permanen? Data yang masih dipakai tidak dapat dihapus.</p>
          <button type="submit" className={`${buttonDanger} text-xs`}>Hapus permanen</button>
        </form>
      </details>
    </div>
  );
}

function ActiveBadge({ isActive }: { isActive: 0 | 1 }) {
  return <Badge tone={isActive ? "success" : "neutral"}>{isActive ? "Aktif" : "Nonaktif"}</Badge>;
}

function MasterDataSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <ChevronDown
          aria-hidden="true"
          size={18}
          className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-slate-100 px-5 py-5">{children}</div>
    </details>
  );
}

export default async function MasterDataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.masterDataView);
  const [brands, brandOptions, companies, divisions, divisionOptions, positions, locations, exitReasons, contractTypes, params] = await Promise.all([
    listBrands(),
    listBrandOptions(),
    listCompanies(),
    listDivisions(),
    listDivisionOptions(),
    listPositions(),
    listLocations(undefined, true),
    listExitReasons(),
    listContractTypes(),
    searchParams,
  ]);
  const canManage = hasPermission(actor, PERMISSIONS.masterDataManage);

  return (
    <div>
      <PageHeader title="Master data" description="Kelola struktur organisasi dan referensi HR yang digunakan oleh seluruh modul." />
      <FlashAlerts {...readFlash(params)} />

      <div className="grid gap-4">
        <MasterDataSection title="Brand" description={`${brands.length} brand terdaftar`}>
            {canManage ? (
              <form action={createBrandAction} className="mb-5 grid gap-2 sm:grid-cols-[0.7fr_1fr_1.4fr_auto]">
                <TextInput name="code" placeholder="Kode" required />
                <TextInput name="name" placeholder="Nama brand" required />
                <TextInput name="description" placeholder="Deskripsi" />
                <Submit />
              </form>
            ) : null}
            <ul className="space-y-2">
              {brands.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm"><b>{item.code}</b> · {item.name}</p>
                      {item.description ? <p className="mt-1 text-xs text-slate-500">{item.description}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ActiveBadge isActive={item.is_active} />
                      {canManage ? (
                        <RecordActions
                          entity="brand"
                          id={item.id}
                          isActive={item.is_active}
                          editForm={
                            <form action={updateBrandAction} className="grid gap-2">
                              <input type="hidden" name="id" value={item.id} />
                              <TextInput name="code" placeholder="Kode" defaultValue={item.code} required />
                              <TextInput name="name" placeholder="Nama brand" defaultValue={item.name} required />
                              <TextInput name="description" placeholder="Deskripsi" defaultValue={item.description ?? ""} />
                              <Submit>Simpan perubahan</Submit>
                            </form>
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
        </MasterDataSection>

        <MasterDataSection title="CV / perusahaan" description={`${companies.length} CV terdaftar`}>
            {canManage ? (
              <form action={createCompanyAction} className="mb-5 grid gap-2 sm:grid-cols-2">
                <select name="brandId" required className={inputClass}>
                  <option value="">Pilih brand</option>
                  {brandOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <TextInput name="name" placeholder="Nama CV" required />
                <TextInput name="address" placeholder="Alamat" />
                <TextInput name="phone" placeholder="Telepon" />
                <TextInput name="email" placeholder="Email" type="email" />
                <TextInput name="npwp" placeholder="NPWP" />
                <TextInput name="nib" placeholder="NIB" />
                <button type="submit" className={`${buttonPrimary} sm:col-span-2`}>Tambah CV</button>
              </form>
            ) : null}
            <ul className="space-y-2">
              {companies.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm">{item.name}</b>
                        <Badge tone="brand">{item.brand_name}</Badge>
                        <ActiveBadge isActive={item.is_active} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.email ?? "Email belum diisi"} · {item.phone ?? "Telepon belum diisi"}</p>
                    </div>
                    {canManage ? (
                      <RecordActions
                        entity="company"
                        id={item.id}
                        isActive={item.is_active}
                        editForm={
                          <form action={updateCompanyAction} className="grid gap-2">
                            <input type="hidden" name="id" value={item.id} />
                            <select name="brandId" required defaultValue={item.brand_id} className={inputClass}>
                              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                            </select>
                            <TextInput name="name" placeholder="Nama CV" defaultValue={item.name} required />
                            <TextInput name="address" placeholder="Alamat" defaultValue={item.address ?? ""} />
                            <TextInput name="phone" placeholder="Telepon" defaultValue={item.phone ?? ""} />
                            <TextInput name="email" placeholder="Email" type="email" defaultValue={item.email ?? ""} />
                            <TextInput name="npwp" placeholder="NPWP" defaultValue={item.npwp ?? ""} />
                            <TextInput name="nib" placeholder="NIB" defaultValue={item.nib ?? ""} />
                            <Submit>Simpan perubahan</Submit>
                          </form>
                        }
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
        </MasterDataSection>

        <MasterDataSection title="Divisi" description={`${divisions.length} divisi terdaftar`}>
          {canManage ? (
            <form action={createDivisionAction} className="mb-5 flex gap-2">
              <TextInput name="name" placeholder="Nama divisi" required />
              <Submit />
            </form>
          ) : null}
          <ul className="space-y-2">
            {divisions.map((division) => (
              <li key={division.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-semibold">{division.name}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <ActiveBadge isActive={division.is_active} />
                  {canManage ? (
                    <RecordActions
                      entity="division"
                      id={division.id}
                      isActive={division.is_active}
                      editForm={
                        <form action={updateDivisionAction} className="grid gap-2">
                          <input type="hidden" name="id" value={division.id} />
                          <TextInput name="name" placeholder="Nama divisi" defaultValue={division.name} required />
                          <Submit>Simpan perubahan</Submit>
                        </form>
                      }
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </MasterDataSection>

        <MasterDataSection title="Jabatan" description={`${positions.length} jabatan terdaftar`}>
          {canManage ? (
            <form action={createPositionAction} className="mb-5 grid gap-2 sm:grid-cols-[1fr_1.3fr_auto]">
              <select name="divisionId" required className={inputClass}>
                <option value="">Divisi</option>
                {divisionOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <TextInput name="name" placeholder="Nama jabatan" required />
              <Submit />
            </form>
          ) : null}
          <ul className="space-y-2">
            {positions.map((position) => (
              <li key={position.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{position.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {divisions.find((division) => division.id === position.division_id)?.name ?? "Tanpa divisi"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ActiveBadge isActive={position.is_active} />
                  {canManage ? (
                    <RecordActions
                      entity="position"
                      id={position.id}
                      isActive={position.is_active}
                      editForm={
                        <form action={updatePositionAction} className="grid gap-2">
                          <input type="hidden" name="id" value={position.id} />
                          <select name="divisionId" required defaultValue={position.division_id} className={inputClass}>
                            {divisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                          <TextInput name="name" placeholder="Nama jabatan" defaultValue={position.name} required />
                          <Submit>Simpan perubahan</Submit>
                        </form>
                      }
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </MasterDataSection>

        <MasterDataSection title="Lokasi" description={`${locations.length} lokasi terdaftar`}>
            {canManage ? (
              <form action={createLocationAction} className="mb-5 grid gap-2 sm:grid-cols-2">
                <select name="brandId" className={inputClass}>
                  <option value="">Semua brand</option>
                  {brandOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <TextInput name="name" placeholder="Nama lokasi" required />
                <TextInput name="city" placeholder="Kota" />
                <TextInput name="address" placeholder="Alamat" />
                <button type="submit" className={`${buttonPrimary} sm:col-span-2`}>Tambah lokasi</button>
              </form>
            ) : null}
            <ul className="space-y-2">
              {locations.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{item.name}</span>
                      {item.city ? <span className="text-xs text-slate-500">{item.city}</span> : null}
                      <Badge tone="brand">{item.brand_name ?? "Global"}</Badge>
                      <ActiveBadge isActive={item.is_active} />
                    </div>
                    {canManage ? (
                      <RecordActions
                        entity="location"
                        id={item.id}
                        isActive={item.is_active}
                        editForm={
                          <form action={updateLocationAction} className="grid gap-2">
                            <input type="hidden" name="id" value={item.id} />
                            <select name="brandId" defaultValue={item.brand_id ?? ""} className={inputClass}>
                              <option value="">Semua brand</option>
                              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                            </select>
                            <TextInput name="name" placeholder="Nama lokasi" defaultValue={item.name} required />
                            <TextInput name="city" placeholder="Kota" defaultValue={item.city ?? ""} />
                            <TextInput name="address" placeholder="Alamat" defaultValue={item.address ?? ""} />
                            <Submit>Simpan perubahan</Submit>
                          </form>
                        }
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
        </MasterDataSection>

        <MasterDataSection title="Alasan keluar" description="Penentuan status rehire karyawan">
            {canManage ? (
              <form action={createExitReasonAction} className="mb-5 grid gap-2 sm:grid-cols-[1fr_0.8fr_0.8fr_auto]">
                <TextInput name="name" placeholder="Nama alasan" required />
                <select name="severity" className={inputClass} defaultValue="GREEN">
                  <option value="GREEN">Hijau</option>
                  <option value="YELLOW">Kuning</option>
                  <option value="RED">Merah</option>
                </select>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="rehirable" defaultChecked /> Bisa rehire</label>
                <Submit />
              </form>
            ) : null}
            <ul className="space-y-2">
              {exitReasons.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.name}</span>
                    <Badge tone={item.severity === "GREEN" ? "success" : item.severity === "YELLOW" ? "warning" : "danger"}>{item.severity} · {item.rehirable ? "Rehire" : "Tidak rehire"}</Badge>
                    <ActiveBadge isActive={item.is_active} />
                  </div>
                  {canManage ? (
                    <RecordActions
                      entity="exit_reason"
                      id={item.id}
                      isActive={item.is_active}
                      editForm={
                        <form action={updateExitReasonAction} className="grid gap-2">
                          <input type="hidden" name="id" value={item.id} />
                          <TextInput name="name" placeholder="Nama alasan" defaultValue={item.name} required />
                          <select name="severity" className={inputClass} defaultValue={item.severity}>
                            <option value="GREEN">Hijau</option>
                            <option value="YELLOW">Kuning</option>
                            <option value="RED">Merah</option>
                          </select>
                          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="rehirable" defaultChecked={item.rehirable === 1} /> Bisa rehire</label>
                          <Submit>Simpan perubahan</Submit>
                        </form>
                      }
                    />
                  ) : null}
                </li>
              ))}
            </ul>
        </MasterDataSection>

        <MasterDataSection title="Jenis kontrak" description="Durasi dan pengingat kontrak kerja">
            {canManage ? (
              <form action={createContractTypeAction} className="mb-5 grid gap-2 sm:grid-cols-2">
                <TextInput name="name" placeholder="Nama jenis kontrak" required />
                <TextInput name="defaultMonths" placeholder="Durasi (bulan)" type="number" />
                <TextInput name="reminderDays" placeholder="Pengingat H-" type="number" defaultValue={14} required />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPermanent" /> Permanen</label>
                <button type="submit" className={`${buttonPrimary} sm:col-span-2`}>Tambah jenis kontrak</button>
              </form>
            ) : null}
            <ul className="space-y-2">
              {contractTypes.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-slate-500">{item.is_permanent ? "Permanen" : `${item.default_months ?? "-"} bulan`}</span>
                    <Badge tone="info">H-{item.reminder_days}</Badge>
                    <ActiveBadge isActive={item.is_active} />
                  </div>
                  {canManage ? (
                    <RecordActions
                      entity="contract_type"
                      id={item.id}
                      isActive={item.is_active}
                      editForm={
                        <form action={updateContractTypeAction} className="grid gap-2">
                          <input type="hidden" name="id" value={item.id} />
                          <TextInput name="name" placeholder="Nama jenis kontrak" defaultValue={item.name} required />
                          <TextInput name="defaultMonths" placeholder="Durasi (bulan)" type="number" defaultValue={item.default_months ?? ""} />
                          <TextInput name="reminderDays" placeholder="Pengingat H-" type="number" defaultValue={item.reminder_days} required />
                          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPermanent" defaultChecked={item.is_permanent === 1} /> Permanen</label>
                          <Submit>Simpan perubahan</Submit>
                        </form>
                      }
                    />
                  ) : null}
                </li>
              ))}
            </ul>
        </MasterDataSection>
      </div>
    </div>
  );
}
