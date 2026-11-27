"use client";
import { useState } from "react";
import Link from "next/link";
import type { SelectOption } from "@/modules/master-data/queries";
import type { FinanceFilters } from "@/modules/dashboard/finance";
import {
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui/primitives";
export default function FinanceFiltersForm({
  filters,
  brands,
  companies,
}: {
  filters: FinanceFilters;
  brands: SelectOption[];
  companies: SelectOption[];
}) {
  const [brand, setBrand] = useState(
    filters.brandId ? String(filters.brandId) : "",
  );
  const [company, setCompany] = useState(
    filters.missingCompany
      ? "missing"
      : filters.companyId
        ? String(filters.companyId)
        : "",
  );
  return (
    <form
      method="get"
      action="/dashboard#finance-employees"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Nama atau kode karyawan
        <input
          name="financeSearch"
          type="search"
          defaultValue={filters.search}
          maxLength={80}
          placeholder="Ketik minimal 2 karakter"
          className={inputClass}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Brand
        <select
          name="financeBrand"
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setCompany("");
          }}
          className={inputClass}
        >
          <option value="">Semua brand dalam akses Anda</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        CV / perusahaan
        <select
          name="financeCompany"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={inputClass}
        >
          <option value="">Semua CV / perusahaan</option>
          <option value="missing">CV belum ditentukan</option>
          {companies
            .filter((c) => !brand || String(c.parentId) === brand)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Status
        <select
          name="financeStatus"
          defaultValue={filters.status}
          className={inputClass}
        >
          <option value="active">Karyawan aktif</option>
          <option value="inactive">Karyawan nonaktif</option>
          <option value="all">Semua status</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
        <button type="submit" className={buttonPrimary}>
          Tampilkan data
        </button>
        <Link href="/dashboard#finance-employees" className={buttonSecondary}>
          Reset
        </Link>
      </div>
    </form>
  );
}
