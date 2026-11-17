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
        className="flex flex-wrap items-center gap-1"
      >
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonSecondary}>
            Sebelumnya
          </Link>
        ) : null}
        {pages.map((n) => (
          <Link
            key={n}
            href={href(n)}
            aria-current={n === page ? "page" : undefined}
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-semibold ${n === page ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {n}
          </Link>
        ))}
        {page < count ? (
          <Link href={href(page + 1)} className={buttonSecondary}>
            Berikutnya
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
