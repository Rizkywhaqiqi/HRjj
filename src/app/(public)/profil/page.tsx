import Link from "next/link";

const brands = [
  { code: "JOJO", name: "Jojo", description: "Brand kuliner dan hospitality dengan fokus pada pengalaman pelanggan yang hangat." },
  { code: "JLY", name: "JLY", description: "Brand dengan portofolio produk dan layanan yang terus berkembang bersama tim terbaik." },
  { code: "GUULAK", name: "Guulak", description: "Brand yang menghadirkan produk kuliner dengan karakter dan kualitas yang konsisten." },
  { code: "ANA", name: "Ana", description: "Brand bakery yang mengutamakan rasa, kualitas, dan pelayanan sehari-hari." },
  { code: "MUTIARA", name: "Mutiara", description: "Brand yang bertumbuh melalui kolaborasi, operasional yang rapi, dan kepedulian pada pelanggan." },
];

export default function PublicProfilePage() {
  return <main className="min-h-screen bg-slate-50 px-5 py-10"><div className="mx-auto max-w-5xl"><Link href="/" className="text-sm font-semibold text-brand-700">← JOJO HR Space</Link><div className="mt-10 max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">JOJO GROUP</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Lima brand, satu ruang untuk bertumbuh.</h1><p className="mt-4 leading-7 text-slate-600">Kenali ekosistem brand JOJO GROUP dan peluang untuk menjadi bagian dari tim kami.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2">{brands.map((brand) => <article key={brand.code} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold tracking-[0.16em] text-brand-700">{brand.code}</p><h2 className="mt-3 text-2xl font-semibold text-slate-900">{brand.name}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{brand.description}</p></article>)}</div><div className="mt-8 rounded-2xl bg-brand-700 p-6 text-white"><h2 className="text-xl font-semibold">Bergabung bersama kami</h2><p className="mt-2 text-sm leading-6 text-white/80">Lihat lowongan yang sedang tersedia dan kirim lamaran melalui portal kandidat.</p><Link href="/karir" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700">Lihat lowongan</Link></div></div></main>;
}
