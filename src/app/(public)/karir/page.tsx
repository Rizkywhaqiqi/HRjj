import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { listOpenVacancies } from "@/modules/recruitment";

export const instant = false;

async function CareersContent() {
  await connection();
  const vacancies = await listOpenVacancies();
  return <main className="min-h-screen bg-slate-50 px-5 py-10"><div className="mx-auto max-w-5xl"><Link href="/" className="text-sm font-semibold text-brand-700">← JOJO HR Space</Link><h1 className="mt-8 text-3xl font-semibold text-slate-900">Karir di JOJO GROUP</h1><p className="mt-2 text-slate-600">Temukan posisi yang sesuai dan kirim lamaran melalui portal kandidat.</p><div className="mt-8 grid gap-4 md:grid-cols-2">{vacancies.map((vacancy) => <article key={vacancy.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{vacancy.brand_name} · {vacancy.company_name}</p><h2 className="mt-2 text-xl font-semibold text-slate-900">{vacancy.title}</h2><p className="mt-1 text-sm text-slate-500">{vacancy.position_name} · {vacancy.location_name}</p><p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{vacancy.description}</p><Link href={`/karir/${vacancy.slug}`} className="mt-5 inline-flex rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white">Lihat lowongan</Link></article>)}{vacancies.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-sm text-slate-500">Belum ada lowongan terbuka.</p> : null}</div></div></main>;
}

export default function CareersPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 px-5 py-10" />}>
      <CareersContent />
    </Suspense>
  );
}
