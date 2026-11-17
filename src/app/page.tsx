import {
  ArrowUpRight,
  BriefcaseBusiness,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

const accessLinks = [
  {
    href: "/login?next=%2Fdashboard",
    icon: LayoutDashboard,
    eyebrow: "Untuk tim HR",
    title: "Dashboard internal",
    description: "Kelola karyawan, operasional, recruitment, dan laporan dalam satu ruang kerja.",
    action: "Masuk ke dashboard",
    className: "bg-[#c4ff55] text-[#171816] hover:bg-[#d5ff8d]",
    iconClassName: "bg-[#171816] text-[#c4ff55]",
  },
  {
    href: "/self-service/login",
    icon: KeyRound,
    eyebrow: "Untuk karyawan",
    title: "Portal karyawan",
    description: "Akses kebutuhan personal karyawan dengan akun portal yang diberikan HR.",
    action: "Buka portal karyawan",
    className: "bg-white text-[#171816] hover:border-[#c4ff55]",
    iconClassName: "bg-[#edf0e8] text-[#4e5f3e]",
  },
  {
    href: "/karir",
    icon: BriefcaseBusiness,
    eyebrow: "Untuk kandidat",
    title: "Peluang karier",
    description: "Lihat lowongan yang sedang dibuka dan ikuti proses rekrutmen JOJO GROUP.",
    action: "Lihat lowongan",
    className: "bg-white text-[#171816] hover:border-[#c4ff55]",
    iconClassName: "bg-[#edf0e8] text-[#4e5f3e]",
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#eef0eb] text-[#171816]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-[#171816]/10 py-5 sm:py-7">
          <Link href="/" aria-label="JOJO HR Space, beranda" className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#171816] text-[#c4ff55]">
              <span className="font-serif text-xl leading-none">J</span>
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#c4ff55]" />
            </span>
            <span className="text-sm font-extrabold tracking-[-0.06em] sm:text-base">JOJO HR SPACE</span>
          </Link>
          <span className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#697166] sm:flex">
            <span className="h-2 w-2 rounded-full bg-[#83bd4a]" />
            Workspace online
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-12 sm:py-16 lg:py-20">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#171816]/10 bg-white/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#697166]">
              <ShieldCheck size={14} aria-hidden="true" />
              Ruang kerja terpusat
            </div>
            <h1 className="mt-6 max-w-3xl font-serif text-[clamp(3rem,8vw,6.5rem)] leading-[0.9] tracking-[-0.075em]">
              Selamat datang di
              <span className="block text-[#607747]">JOJO HR Space.</span>
            </h1>
            <p className="mt-7 max-w-xl text-sm leading-7 text-[#697166] sm:text-base">
              Pilih workspace yang ingin Anda buka untuk melanjutkan aktivitas.
            </p>
          </div>

          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#697166]">Pilih workspace</h2>
              <span className="text-xs text-[#8a9185]">3 akses tersedia</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
            {accessLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex min-h-64 flex-col justify-between rounded-[1.5rem] border border-[#171816]/10 p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-30px_rgba(23,24,22,0.5)] sm:p-6 ${item.className}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.iconClassName}`}>
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <ArrowUpRight className="transition duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">{item.eyebrow}</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{item.title}</h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 opacity-70">{item.description}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em]">
                      {item.action}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              );
            })}
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-[#171816]/10 py-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#697166] sm:flex-row sm:items-center sm:justify-between sm:py-6">
          <span>JOJO GROUP · HR WORKSPACE</span>
          <span>Secure access · Internal operations</span>
        </footer>
      </div>
    </main>
  );
}
