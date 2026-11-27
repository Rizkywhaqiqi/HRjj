import Link from "next/link";
import { buttonSecondary } from "@/components/ui/primitives";
export default function ReportPagination({
  page,
  pageSize,
  total,
  query,
}: {
  page: number;
  pageSize: number;
  total: number;
  query: Record<string, string>;
}) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.max(1, Math.min(page - 2, count - 4));
  const pages = Array.from({ length: Math.min(5, count) }, (_, i) => start + i);
  const href = (n: number) =>
    `/reports?${new URLSearchParams({ ...query, page: String(n) })}`;
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} dari ${total} karyawan`
          : "0 karyawan"}{" "}
        · Halaman {page} dari {count}
      </p>
      <nav
        aria-label="Navigasi halaman laporan"
        className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end"
      >
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            className={`${buttonSecondary} order-2 sm:order-1`}
          >
            Sebelumnya
          </Link>
        ) : null}
        <div className="order-1 flex w-full flex-wrap justify-center gap-1 sm:order-2 sm:w-auto">
          {pages.map((n) => (
            <Link
              key={n}
              href={href(n)}
              aria-current={n === page ? "page" : undefined}
              className={`inline-flex h-11 min-w-11 items-center justify-center rounded-lg border px-2 text-sm font-semibold ${n === page ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {n}
            </Link>
          ))}
        </div>
        {page < count ? (
          <Link href={href(page + 1)} className={`${buttonSecondary} order-3`}>
            Berikutnya
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
