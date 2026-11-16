import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BriefcaseBusiness, KeyRound, LogOut } from "lucide-react";
import type { NavSection } from "@/core/module-registry";
import type { SessionUser } from "@/types/database";
import { logoutAction } from "@/modules/users/actions";
import { Badge, cn } from "@/components/ui/primitives";
import { MobileNav } from "./mobile-nav";
import { NavSectionGroups } from "./nav-section-groups";

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
        <BriefcaseBusiness aria-hidden="true" size={19} />
      </div>
      <div>
        <p className="text-xs font-bold tracking-[0.16em] text-brand-700">
          JOJO GROUP
        </p>
        <p className="text-xs font-medium text-slate-500">HR Space</p>
      </div>
    </div>
  );
}

function SidebarNav({ sections }: { sections: NavSection[] }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="flex-1 space-y-3 overflow-y-auto px-3 pb-4"
    >
      <Suspense
        fallback={
          <div className="space-y-3 px-3" aria-hidden="true">
            {sections.map((section) => (
              <div
                key={section.label}
                className="h-9 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        }
      >
        <NavSectionGroups sections={sections} idPrefix="desktop-nav" />
      </Suspense>
    </nav>
  );
}

function ScopeBadge({ user }: { user: SessionUser }) {
  if (user.scopeAll) {
    return <Badge tone="brand">Semua brand</Badge>;
  }

  return (
    <Badge tone="neutral">
      {user.brandIds.length === 0
        ? "Tanpa akses brand"
        : `${user.brandIds.length} brand`}
    </Badge>
  );
}

export function AppShell({
  user,
  sections,
  children,
}: {
  user: SessionUser;
  sections: NavSection[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:flex-col">
        <div className="px-5 py-5">
          <BrandMark />
        </div>
        <SidebarNav sections={sections} />
        <div className="border-t border-slate-200 p-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-500">{user.roleName}</p>
            <div className="mt-2">
              <ScopeBadge user={user} />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <Link
              href="/ganti-password"
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              <KeyRound aria-hidden="true" size={15} />
              Ganti password
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                <LogOut aria-hidden="true" size={15} />
                Keluar
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <BrandMark />
          <MobileNav
            sections={sections}
            user={{ name: user.name, roleName: user.roleName }}
          />
        </header>
        <main
          className={cn(
            "mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6",
            "sm:px-6 lg:px-8",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
