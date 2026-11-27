"use client";
import { useState } from "react";
import type { SelectOption } from "@/modules/master-data/queries";
import { transferEmployeeAction } from "@/modules/finance/actions";
import { SubmitButton } from "@/components/ui/form";
import { inputClass } from "@/components/ui/primitives";
export default function PlacementForm({
  id,
  today,
  brands,
  companies,
  positions,
  locations,
}: {
  id: number;
  today: string;
  brands: SelectOption[];
  companies: SelectOption[];
  positions: SelectOption[];
  locations: { id: number; name: string; brand_id: number | null }[];
}) {
  const [brand, setBrand] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  return (
    <form action={transferEmployeeAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="employeeId" value={id} />
      <label className="grid gap-1 text-sm">
        Brand tujuan
        <select
          required
          className={inputClass}
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setCompany("");
            setLocation("");
          }}
        >
          <option value="">Pilih brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        CV tujuan
        <select
          required
          name="companyId"
          className={inputClass}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={!brand}
        >
          <option value="">Pilih CV</option>
          {companies
            .filter((c) => String(c.parentId) === brand)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Jabatan
        <select required name="positionId" className={inputClass}>
          <option value="">Pilih jabatan</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Outlet
        <select
          required
          name="locationId"
          className={inputClass}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={!brand}
        >
          <option value="">Pilih outlet</option>
          {locations
            .filter((l) => l.brand_id === null || String(l.brand_id) === brand)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Tanggal berlaku
        <input
          type="date"
          readOnly
          name="effectiveDate"
          value={today}
          className={inputClass}
        />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">
        Alasan mutasi
        <textarea
          required
          minLength={10}
          maxLength={500}
          name="reason"
          className={inputClass}
        />
      </label>
      <p className="text-xs text-slate-500 sm:col-span-2">
        Mutasi berlaku hari ini. Tidak mengubah perusahaan penerbit pada
        snapshot surat lama atau nominal gaji.
      </p>
      <div>
        <SubmitButton pendingLabel="Mencatat mutasi...">
          Simpan mutasi
        </SubmitButton>
      </div>
    </form>
  );
}
