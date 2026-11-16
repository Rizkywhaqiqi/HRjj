import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { brandProfiles } from "@/modules/brand-profile";

export default function Home() {
  return (
    <main className="overflow-hidden bg-[#e6e6e3] text-[#181917]">
      <section className="relative flex min-h-[640px] h-[88svh] max-h-[850px] flex-col overflow-hidden sm:min-h-[720px] sm:h-[100svh] sm:max-h-[1050px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,rgba(255,255,255,0.65),transparent_48%)]"
        />
        <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 sm:py-6 lg:px-12">
          <Link
            href="/"
            aria-label="JOJO GROUP, beranda"
            className="flex items-center gap-2.5"
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-[#181917]">
              <span className="font-serif text-lg leading-none">J</span>
              <span className="absolute -right-0.5 top-0 h-2 w-2 rounded-full bg-[#c4ff55]" />
            </span>
            <span className="text-sm font-extrabold tracking-[-0.06em] sm:text-base">
              JOJO GROUP
            </span>
          </Link>

          <a
            href="#brand"
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wide sm:inline-flex"
          >
            Jelajahi brand
            <ArrowDown aria-hidden="true" size={12} />
          </a>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              aria-label="Dashboard Admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#181917]/20 bg-white px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide transition hover:border-[#181917] sm:gap-2 sm:px-4 sm:text-xs"
            >
              <LayoutDashboard aria-hidden="true" size={14} />
              <span className="sm:hidden">Admin</span>
              <span className="hidden sm:inline">Dashboard Admin</span>
            </Link>
            <Link
              href="/karir"
              className="inline-flex items-center gap-2 rounded-full bg-[#c4ff55] px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide transition hover:bg-[#b2f03f] sm:px-5 sm:text-xs"
            >
              Tumbuh bersama
              <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </header>

        <div className="absolute inset-x-0 top-[15%] flex flex-wrap items-center justify-center gap-2 px-4 sm:top-[17%] sm:flex-nowrap sm:gap-3 md:gap-4">
          {brandProfiles.map((brand, index) => (
            <Link
              key={brand.code}
              href={`/brand/${brand.slug}`}
              aria-label={`Buka profil brand ${brand.name}`}
              style={{
                animationDelay: `${index * -0.8}s`,
                animationDuration: `${5.6 + index * 0.35}s`,
                borderRadius: brand.shape,
                background: brand.surface,
                boxShadow:
                  "inset 8px 10px 24px rgba(255,255,255,0.42), inset -12px -18px 24px rgba(0,0,0,0.18), 0 30px 38px -22px rgba(24,25,23,0.48)",
              }}
              className={`animate-brand-card-float relative aspect-square w-[calc((100vw-64px)/3)] max-w-[190px] overflow-hidden border border-white/35 sm:w-[calc((100vw-100px)/5)] ${
                index === 0 || index === 4 ? "sm:translate-y-12" : ""
              } ${index === 1 ? "sm:-translate-y-8" : ""} ${
                index === 3 ? "sm:translate-y-4" : ""
              } ${brand.objectText} transition hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#181917]`}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.28),transparent_44%,rgba(0,0,0,0.18))]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[14%] top-[10%] h-[28%] w-[54%] rounded-full bg-white/45 blur-xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-[8%] rounded-full border border-white/35"
                style={{ transform: "rotateX(68deg) rotateZ(-24deg)" }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-[18%] rounded-full border border-white/20"
                style={{ transform: "rotateX(68deg) rotateZ(22deg)" }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Sparkles
                  aria-hidden="true"
                  className="mb-2 opacity-80"
                  size={18}
                  strokeWidth={1.5}
                />
                <span className="font-serif text-[clamp(2.6rem,9vw,5.5rem)] leading-[0.8] tracking-[-0.08em] drop-shadow-[0_5px_8px_rgba(0,0,0,0.16)]">
                  {brand.mark}
                </span>
                <span className="mt-3 text-[9px] font-extrabold tracking-[0.18em] sm:text-[10px]">
                  {brand.wordmark}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="relative z-[1] mt-auto grid grid-cols-2 items-end gap-x-5 gap-y-6 px-5 pb-8 sm:grid-cols-[1fr_2.2fr_1fr] sm:gap-8 sm:px-8 sm:pb-10 lg:px-12">
          <p className="text-[9px] font-extrabold uppercase leading-tight tracking-wide sm:text-[10px]">
            Group profile
            <br />
            Lima brand · Satu ekosistem
          </p>
          <h1 className="col-span-2 max-w-4xl font-serif text-[clamp(2rem,8vw,3rem)] leading-[0.95] tracking-[-0.065em] sm:col-span-1 sm:text-center sm:text-[clamp(2.6rem,6.5vw,6.2rem)] sm:leading-[0.91]">
            Banyak cerita.
            <br />
            Satu ruang tumbuh.
          </h1>
          <a
            href="#tentang"
            className="col-start-2 row-start-1 justify-self-end text-right text-[9px] font-extrabold uppercase leading-tight tracking-wide sm:col-start-auto sm:row-start-auto sm:text-left sm:text-[10px]"
          >
            Kenali
            <br />
            JOJO GROUP
            <ArrowDown
              aria-hidden="true"
              className="ml-auto mt-2 sm:ml-0"
              size={14}
            />
          </a>
        </div>
      </section>

      <section
        id="tentang"
        className="bg-[#171816] px-5 py-20 text-[#f0f0eb] sm:px-8 sm:py-28 lg:px-12 lg:py-36"
      >
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c4ff55]">
            01 / Cara kami bertumbuh
          </p>
          <div>
            <p className="font-serif text-[clamp(2.6rem,6vw,5.8rem)] leading-[0.98] tracking-[-0.055em]">
              Kami percaya,{" "}
              <span className="text-[#c4ff55]">setiap brand punya cerita</span>{" "}
              yang layak dikenal.
            </p>
            <p className="mt-8 max-w-2xl text-sm leading-7 text-white/60 sm:text-base sm:leading-8">
              JOJO GROUP menaungi brand dengan karakter dan fokus yang beragam.
              Kami merawat kualitas, pengalaman pelanggan, dan kolaborasi agar
              setiap brand dapat terus berkembang dengan caranya sendiri.
            </p>
          </div>
        </div>
      </section>

      <section
        id="brand"
        className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 border-b border-[#181917]/20 pb-7 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#62655e]">
                02 / Brand kami
              </p>
              <h2 className="mt-4 font-serif text-[clamp(2.8rem,6vw,5.5rem)] leading-none tracking-[-0.06em]">
                Lima dunia.
                <br className="sm:hidden" /> Satu keluarga.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#686b64]">
              Kenali brand yang membentuk perjalanan JOJO GROUP, masing-masing
              dengan karakter dan kisahnya sendiri.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {brandProfiles.map((brand, index) => (
              <Link
                key={brand.code}
                href={`/brand/${brand.slug}`}
                aria-label={`Buka profil brand ${brand.name}`}
                className="group rounded-[1.5rem] border border-[#181917]/10 bg-white p-4 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-35px_rgba(24,25,23,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181917] sm:p-5"
              >
                <div
                  className={`relative flex h-32 items-center justify-center overflow-hidden rounded-[1.1rem] sm:h-40 ${brand.colors}`}
                >
                  <div
                    aria-hidden="true"
                    className={`absolute -right-[8%] -top-[45%] h-40 w-40 rounded-full border ${brand.motif}`}
                  />
                  <div
                    aria-hidden="true"
                    className={`absolute -bottom-[55%] -left-[8%] h-40 w-40 rounded-full border ${brand.motif}`}
                  />
                  <span className="relative font-serif text-7xl leading-none tracking-[-0.08em] sm:text-8xl">
                    {brand.mark}
                  </span>
                  <span className="absolute bottom-3 left-4 text-[9px] font-extrabold tracking-[0.18em] sm:bottom-4 sm:left-5 sm:text-[10px]">
                    {brand.wordmark}
                  </span>
                  <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/75 transition group-hover:bg-[#c4ff55] sm:right-4 sm:top-4">
                    <ArrowUpRight aria-hidden="true" size={15} />
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.16em] text-[#85877f] sm:text-[10px]">
                      0{index + 1} / {brand.code}
                    </p>
                    <h3 className="mt-1 font-serif text-2xl tracking-[-0.04em] sm:text-3xl">
                      {brand.name}
                    </h3>
                  </div>
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${brand.colors}`}
                  >
                    <span className="font-serif text-xl">{brand.mark}</span>
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#686b64]">
                  {brand.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[1.75rem] bg-[#c4ff55] sm:grid-cols-[1.2fr_0.8fr] sm:rounded-[2rem]">
          <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]">
              03 / Bergabung dengan kami
            </p>
            <h2 className="mt-5 max-w-2xl font-serif text-[clamp(2.8rem,6vw,5.8rem)] leading-[0.95] tracking-[-0.06em]">
              Cerita berikutnya, bersama Anda.
            </h2>
            <Link
              href="/karir"
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#171816] px-5 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-[#353731]"
            >
              Lihat peluang karier
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>
          <div
            aria-hidden="true"
            className="relative hidden min-h-[300px] items-center justify-center overflow-hidden sm:flex"
          >
            <div className="absolute h-72 w-72 rounded-full border border-[#171816]/25" />
            <div className="absolute h-52 w-52 rounded-full border border-[#171816]/25" />
            <div className="absolute h-32 w-32 rounded-full bg-[#171816] text-[#c4ff55]">
              <span className="flex h-full items-center justify-center font-serif text-6xl">
                J
              </span>
            </div>
            <Sparkles
              className="absolute right-[20%] top-[22%]"
              size={26}
              strokeWidth={1.3}
            />
            <Sparkles
              className="absolute bottom-[20%] left-[22%]"
              size={19}
              strokeWidth={1.3}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#181917]/15 px-5 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="text-sm font-extrabold tracking-[-0.06em]"
          >
            JOJO GROUP
          </Link>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#686b64]">
            Beragam karakter, satu ruang untuk tumbuh.
          </p>
          <div className="flex gap-5 text-xs font-semibold">
            <Link
              href="/profil"
              className="transition hover:text-[#5d7935]"
            >
              Profil
            </Link>
            <Link
              href="/karir"
              className="transition hover:text-[#5d7935]"
            >
              Karier
            </Link>
            <Link
              href="/self-service/login"
              className="transition hover:text-[#5d7935]"
            >
              Portal karyawan
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
