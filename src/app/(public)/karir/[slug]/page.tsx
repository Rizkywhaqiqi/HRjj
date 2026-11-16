import Link from "next/link";
import { notFound } from "next/navigation";
import { getVacancyBySlug, applyToVacancyAction } from "@/modules/recruitment";
import { getCandidateSessionUser } from "@/core/auth/candidate-session";

export const instant = false;

export default async function VacancyPage({ params }: { params: Promise<{ slug: string }> }) {
  const vacancy = await getVacancyBySlug((await params).slug);
  if (!vacancy) notFound();
  const candidate = await getCandidateSessionUser();
  return <main className="min-h-screen bg-slate-50 px-5 py-10"><div className="mx-auto max-w-3xl"><Link href="/karir" className="text-sm font-semibold text-brand-700">← Semua lowongan</Link><article className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{vacancy.brand_name} · {vacancy.company_name}</p><h1 className="mt-2 text-3xl font-semibold text-slate-900">{vacancy.title}</h1><p className="mt-2 text-sm text-slate-500">{vacancy.position_name} · {vacancy.location_name}</p><h2 className="mt-8 font-semibold">Deskripsi</h2><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{vacancy.description}</p><h2 className="mt-8 font-semibold">Persyaratan</h2><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{vacancy.requirements}</p><div className="mt-8 rounded-xl bg-slate-50 p-4">{candidate ? <form action={applyToVacancyAction} className="space-y-3"><input type="hidden" name="vacancyId" value={vacancy.id} /><label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" name="consent" required /> Saya menyetujui pemrosesan data untuk proses rekrutmen sesuai pemberitahuan privasi versi 2026-01.</label><button type="submit" className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white">Kirim lamaran</button></form> : <p className="text-sm text-slate-600">Silakan <Link className="font-semibold text-brand-700" href={`/kandidat/login?next=/karir/${vacancy.slug}`}>login kandidat</Link> untuk melamar.</p>}</div></article></div></main>;
}
