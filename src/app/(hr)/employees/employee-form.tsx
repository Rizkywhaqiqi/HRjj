"use client";

import { SubmitButton } from "@/components/ui/form";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { SelectOption } from "@/modules/master-data/queries";
import {
  Alert,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui/primitives";

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required ? (
          <span className="ml-1 text-rose-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export default function EmployeeForm({
  action,
  brands,
  companies,
  divisions,
  positions,
  locations,
  canViewSensitive,
}: {
  action: (formData: FormData) => void;
  brands: SelectOption[];
  companies: SelectOption[];
  divisions: SelectOption[];
  positions: SelectOption[];
  locations: { id: number; name: string }[];
  canViewSensitive: boolean;
}) {
  const [brandId, setBrandId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [positionId, setPositionId] = useState("");
  const filteredCompanies = useMemo(
    () =>
      companies.filter((item) => !brandId || String(item.parentId) === brandId),
    [companies, brandId],
  );
  const filteredPositions = useMemo(
    () =>
      positions.filter(
        (item) => !divisionId || String(item.parentId) === divisionId,
      ),
    [positions, divisionId],
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="returnPath" value="/employees/new" />
      <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        Karyawan langsung aktif setelah nama dan penempatan dipilih. Data
        pribadi yang kosong dapat dilengkapi nanti.
      </div>

      <FormSection
        title="Identitas & keluarga"
        description="Isi jika tersedia. NIK, tempat/tanggal lahir, dan data keluarga dapat dilengkapi setelah karyawan aktif."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nama lengkap" required>
            <input
              name="fullName"
              required
              autoComplete="name"
              className={inputClass}
            />
          </FormField>
          <FormField label="NIK (16 digit, bisa dilengkapi nanti)">
            <input
              name="nik"
              inputMode="numeric"
              pattern="[0-9]{16}"
              maxLength={16}
              autoComplete="off"
              className={inputClass}
            />
          </FormField>
          <FormField label="Tempat lahir">
            <input name="birthPlace" className={inputClass} />
          </FormField>
          <FormField label="Tanggal lahir">
            <input name="birthDate" type="date" className={inputClass} />
          </FormField>
          <FormField label="Status pernikahan">
            <select name="maritalStatus" defaultValue="" className={inputClass}>
              <option value="">Belum diisi</option>
              <option value="SINGLE">Belum menikah</option>
              <option value="MARRIED">Menikah</option>
              <option value="DIVORCED">Cerai</option>
            </select>
          </FormField>
          <FormField label="Jumlah anak">
            <input
              name="childrenCount"
              type="number"
              min="0"
              max="30"
              className={inputClass}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Kontak & alamat"
        description="Nomor telepon dan alamat dapat dilengkapi setelah karyawan aktif."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nomor telepon">
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              className={inputClass}
            />
          </FormField>
          <FormField label="Email (opsional)">
            <input
              name="email"
              type="email"
              autoComplete="email"
              className={inputClass}
            />
          </FormField>
          <FormField label="Alamat domisili">
            <textarea name="addressCurrent" rows={3} className={inputClass} />
          </FormField>
          <FormField label="Alamat sesuai KTP">
            <textarea name="addressKtp" rows={3} className={inputClass} />
          </FormField>
          <FormField label="Foto KTP (JPG/PNG, maksimal 1,5 MB)">
            <input
              name="ktpPhoto"
              type="file"
              accept="image/jpeg,image/png"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Penempatan kerja"
        description="Brand, CV, divisi, jabatan, dan lokasi diperlukan agar karyawan masuk ke unit kerja yang benar."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Tanggal mulai kerja">
            <input name="joinDate" type="date" className={inputClass} />
          </FormField>
          <FormField label="Brand" required>
            <select
              required
              value={brandId}
              onChange={(event) => {
                setBrandId(event.target.value);
                setCompanyId("");
              }}
              className={inputClass}
            >
              <option value="">Pilih brand</option>
              {brands.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="CV / perusahaan" required>
            <select
              name="companyId"
              required
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              className={inputClass}
            >
              <option value="">Pilih CV</option>
              {filteredCompanies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Divisi" required>
            <select
              required
              value={divisionId}
              onChange={(event) => {
                setDivisionId(event.target.value);
                setPositionId("");
              }}
              className={inputClass}
            >
              <option value="">Pilih divisi</option>
              {divisions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Jabatan" required>
            <select
              name="positionId"
              required
              value={positionId}
              onChange={(event) => setPositionId(event.target.value)}
              className={inputClass}
            >
              <option value="">Pilih jabatan</option>
              {filteredPositions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Lokasi kerja" required>
            <select
              name="locationId"
              required
              defaultValue=""
              className={inputClass}
            >
              <option value="">Pilih lokasi</option>
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </FormSection>

      {canViewSensitive ? (
        <FormSection
          title="Data sensitif"
          description="Hanya pengguna dengan izin khusus yang dapat mengisi data ini."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="NPWP (opsional)">
              <input name="npwp" autoComplete="off" className={inputClass} />
            </FormField>
            <FormField label="Nama bank (opsional)">
              <input
                name="bankName"
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
            <FormField label="Nomor rekening (opsional)">
              <input
                name="bankAccountNumber"
                inputMode="numeric"
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
          </div>
        </FormSection>
      ) : (
        <Alert tone="info">
          NPWP dan rekening bank hanya dapat diisi oleh pengguna dengan izin
          data sensitif.
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <Link href="/employees" className={buttonSecondary}>
          Batal
        </Link>
        <SubmitButton unstyled className={buttonPrimary}>
          Simpan & aktifkan
        </SubmitButton>
      </div>
    </form>
  );
}
