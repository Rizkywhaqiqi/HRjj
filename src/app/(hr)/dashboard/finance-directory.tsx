import Link from "next/link";
import type { SelectOption } from "@/modules/master-data/queries";
import type { FinanceFilters } from "@/modules/dashboard/finance";
import { financeFilterQuery } from "@/modules/dashboard/finance";
import type { FinanceDirectoryResult } from "@/modules/dashboard/queries";
import {
  Badge,
  Card,
  CardHeader,
  CardBody,
  EmptyState,
} from "@/components/ui/primitives";
import { Pagination } from "@/components/shared/pagination";
import FinanceFiltersForm from "./finance-filters";
export default function FinanceDirectory({
  result,
  filters,
  brands,
  companies,
  canOpenEmployee,
}: {
  result: FinanceDirectoryResult;
  filters: FinanceFilters;
  brands: SelectOption[];
  companies: SelectOption[];
  canOpenEmployee: boolean;
}) {
  return (
    <section
      id="finance-employees"
      className="scroll-mt-24"
      aria-label="Data karyawan untuk keuangan"
    >
      <Card>
        <CardHeader
          title="Data karyawan untuk keuangan"
          description="Lihat nama, CV/perusahaan, dan brand untuk menyiapkan gajian. Secara default hanya karyawan aktif yang ditampilkan."
        />
        <CardBody className="space-y-5">
          <FinanceFiltersForm
            key={JSON.stringify(filters)}
            filters={filters}
            brands={brands}
            companies={companies}
          />
          <p role="status" className="text-sm text-slate-500">
            {result.total} karyawan sesuai filter · 25 data per halaman ·
            mengikuti akses brand akun
          </p>
          {result.rows.length ? (
            <div className="responsive-table-wrap overflow-x-auto">
              <table
                role="table"
                className="responsive-data-table w-full min-w-[640px] text-left text-sm"
              >
                <caption className="sr-only">
                  Nama karyawan, CV atau perusahaan, dan brand
                </caption>
                <thead
                  role="rowgroup"
                  className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"
                >
                  <tr role="row">
                    <th scope="col" className="px-3 py-3">
                      Nama karyawan
                    </th>
                    <th scope="col" className="px-3 py-3">
                      CV / perusahaan
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Brand
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-100">
                  {result.rows.map((e) => (
                    <tr role="row" key={e.id} className="align-top">
                      <td role="cell" className="px-3 py-4">
                        <span aria-hidden="true" className="mobile-cell-label">
                          Nama karyawan
                        </span>
                        {canOpenEmployee ? (
                          <Link
                            href={`/employees/${e.id}`}
                            className="font-semibold text-slate-900 hover:underline"
                          >
                            {e.full_name}
                          </Link>
                        ) : (
                          <p className="font-semibold text-slate-900">
                            {e.full_name}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          {e.employee_code}
                        </p>
                        {!e.is_active ? <Badge>Nonaktif</Badge> : null}
                      </td>
                      <td role="cell" className="px-3 py-4">
                        <span aria-hidden="true" className="mobile-cell-label">
                          CV / perusahaan
                        </span>
                        {e.company_name ?? (
                          <Badge tone="warning">CV belum ditentukan</Badge>
                        )}
                      </td>
                      <td role="cell" className="px-3 py-4">
                        <span aria-hidden="true" className="mobile-cell-label">
                          Brand
                        </span>
                        {e.brand_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Tidak ada karyawan sesuai filter"
              description={
                filters.search.length === 1
                  ? "Gunakan minimal 2 karakter untuk mencari nama atau kode."
                  : "Coba ubah pencarian, CV, brand, atau status karyawan."
              }
            />
          )}
          <Pagination
            page={result.page}
            pageSize={25}
            total={result.total}
            basePath="/dashboard"
            query={financeFilterQuery(filters)}
          />
        </CardBody>
      </Card>
    </section>
  );
}
