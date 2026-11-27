import Link from "next/link";
import { cn } from "@/components/ui/primitives";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  query,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  query: Record<string, string | undefined>;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  if (pageCount <= 1) {
    return null;
  }

  const hrefFor = (target: number) => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params.set(key, value);
      }
    }

    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  };

  const linkClass =
    "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50";
  const disabledClass = "pointer-events-none opacity-40";

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-slate-500">
        Halaman {page} dari {pageCount} · {total} data
      </p>
      <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto">
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(linkClass, page <= 1 && disabledClass)}
        >
          Sebelumnya
        </Link>
        <Link
          href={hrefFor(Math.min(pageCount, page + 1))}
          aria-disabled={page >= pageCount}
          tabIndex={page >= pageCount ? -1 : undefined}
          className={cn(linkClass, page >= pageCount && disabledClass)}
        >
          Berikutnya
        </Link>
      </div>
    </div>
  );
}

export function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
