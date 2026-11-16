import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicBrandProfile } from "@/modules/brand-profile";

export const instant = false;

export default async function BrandProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getPublicBrandProfile(slug);

  if (!brand) notFound();

  return (
    <main className="min-h-screen bg-[#e6e6e3] text-[#181917]">
      <header className="flex items-center justify-between border-b border-[#181917]/10 px-5 py-5 sm:px-8 lg:px-12">
        <Link
          href="/#brand"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#50534d] transition hover:text-[#181917]"
        >
          <ArrowLeft aria-hidden="true" size={15} />
          Semua brand
        </Link>
        <Link
          href="/"
          className="text-sm font-extrabold tracking-[-0.06em]"
        >
          JOJO GROUP
        </Link>
        <Link
          href="/karir"
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide transition hover:text-[#5d7935]"
        >
          Karier
          <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20 lg:px-12 lg:py-28">
        <div
          className={`relative mx-auto flex aspect-square w-full max-w-[360px] flex-col items-center justify-center overflow-hidden rounded-[2rem] ${brand.colors}`}
          aria-label={`Logo ${brand.name}`}
          role="img"
        >
          <div
            aria-hidden="true"
            className={`absolute -right-[15%] -top-[10%] aspect-square w-[75%] rounded-full border ${brand.motif}`}
          />
          <div
            aria-hidden="true"
            className={`absolute -bottom-[14%] -left-[12%] aspect-square w-[70%] rounded-full border ${brand.motif}`}
          />
          <span className="relative font-serif text-[clamp(7rem,20vw,12rem)] leading-[0.75] tracking-[-0.08em]">
            {brand.mark}
          </span>
          <span className="relative mt-7 text-sm font-extrabold tracking-[0.24em]">
            {brand.wordmark}
          </span>
          <span className="absolute bottom-6 left-6 font-serif text-sm italic opacity-70">
            JOJO GROUP
          </span>
        </div>

        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#666a62]">
            {brand.code} / JOJO GROUP
          </p>
          <h1 className="mt-4 font-serif text-[clamp(3.5rem,8vw,7.5rem)] leading-[0.9] tracking-[-0.065em]">
            {brand.name}
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-[#62665f] sm:text-lg">
            {brand.description}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#181917]/15 px-4 py-2 text-xs font-semibold">
              Bagian dari JOJO GROUP
            </span>
            <span className="rounded-full border border-[#181917]/15 px-4 py-2 text-xs font-semibold">
              {brand.branches.length} cabang terdaftar
            </span>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#777a73]">
            Profil brand
          </p>
          <div className="mt-4 grid gap-8 sm:grid-cols-[0.8fr_1.2fr] sm:items-start">
            <h2 className="font-serif text-4xl leading-tight tracking-[-0.05em] sm:text-5xl">
              Cerita dan karakter {brand.name}.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[#62665f] sm:text-base sm:leading-8">
              {brand.description} Sebagai bagian dari JOJO GROUP, {brand.name}{" "}
              terus berkembang dengan karakter dan fokusnya sendiri.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="flex flex-col justify-between gap-5 border-b border-[#181917]/20 pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#777a73]">
              Lokasi
            </p>
            <h2 className="mt-3 font-serif text-4xl tracking-[-0.05em] sm:text-5xl">
              Alamat cabang
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#686b64]">
            Lokasi aktif yang terdaftar untuk brand {brand.name}.
          </p>
        </div>

        {brand.branches.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {brand.branches.map((branch, index) => (
              <article
                key={branch.id}
                className="rounded-2xl border border-[#181917]/10 bg-white p-6 sm:p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#85877f]">
                      Cabang {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-2 font-serif text-2xl">{branch.name}</h3>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c4ff55]">
                    <MapPin aria-hidden="true" size={18} />
                  </span>
                </div>
                {branch.city ? (
                  <p className="mt-5 text-sm font-semibold text-[#41443e]">
                    {branch.city}
                  </p>
                ) : null}
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#686b64]">
                  {branch.address || "Alamat cabang belum dilengkapi."}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-[#181917]/20 bg-white/70 px-6 py-10 text-center">
            <MapPin
              aria-hidden="true"
              className="mx-auto text-[#777a73]"
              size={24}
            />
            <p className="mt-4 text-sm font-semibold">
              Belum ada alamat cabang yang terdaftar.
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#686b64]">
              Informasi cabang untuk {brand.name} akan tampil di sini setelah
              datanya ditambahkan.
            </p>
          </div>
        )}
      </section>

      <section className="px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 rounded-[1.75rem] bg-[#171816] px-6 py-9 text-white sm:flex-row sm:items-center sm:px-10 sm:py-11">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c4ff55]">
              Tumbuh bersama JOJO GROUP
            </p>
            <h2 className="mt-3 font-serif text-3xl tracking-[-0.04em] sm:text-4xl">
              Jelajahi perjalanan karier Anda.
            </h2>
          </div>
          <Link
            href="/karir"
            className="inline-flex shrink-0 items-center gap-3 self-start rounded-full bg-[#c4ff55] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#171816] transition hover:bg-[#b2f03f] sm:self-center"
          >
            Lihat peluang karier
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </section>

      <footer className="flex flex-col gap-4 border-t border-[#181917]/15 px-5 py-6 text-xs text-[#686b64] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Link href="/" className="font-extrabold tracking-[-0.06em] text-[#181917]">
          JOJO GROUP
        </Link>
        <Link href="/#brand" className="inline-flex items-center gap-2 font-semibold">
          <ArrowLeft aria-hidden="true" size={14} />
          Kembali ke semua brand
        </Link>
      </footer>
    </main>
  );
}
