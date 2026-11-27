export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-5"
    >
      <span className="sr-only">Memuat halaman…</span>
      <div
        aria-hidden="true"
        className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none"
      />
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((id) => (
          <div
            key={id}
            className="h-24 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none"
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="h-64 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none"
      />
    </div>
  );
}
