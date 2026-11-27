"use client";
import { useState } from "react";
import type { SelectOption } from "@/modules/master-data/queries";
import { inputClass } from "@/components/ui/primitives";
export default function OrganizationFilters({
  brands,
  companies,
  locations,
  initialBrand = "",
  initialCompany = "",
  initialLocation = "",
}: {
  brands: SelectOption[];
  companies: SelectOption[];
  locations: { id: number; name: string; brand_id?: number | null }[];
  initialBrand?: string;
  initialCompany?: string;
  initialLocation?: string;
}) {
  const [brand, setBrand] = useState(initialBrand);
  const [company, setCompany] = useState(initialCompany);
  const [location, setLocation] = useState(initialLocation);
  return (
    <div className="contents">
      <label className="grid gap-1.5 text-sm font-medium text-slate-600">
        Brand
        <select
          className={inputClass}
          aria-label="Brand"
          name="brand"
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setCompany("");
            setLocation("");
          }}
        >
          <option value="">Semua dalam akses Anda</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-600">
        CV / perusahaan
        <select
          className={inputClass}
          aria-label="CV / perusahaan"
          name="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="">Semua dalam akses Anda</option>
          {companies
            .filter((c) => !brand || String(c.parentId) === brand)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-600">
        Outlet
        <select
          className={inputClass}
          aria-label="Outlet"
          name="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          <option value="">Semua dalam akses Anda</option>
          {locations
            .filter(
              (l) =>
                !brand || l.brand_id === null || String(l.brand_id) === brand,
            )
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}
