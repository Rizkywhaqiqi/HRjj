"use client";

import { useState } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { KeyRound, LogOut, Menu, X } from "lucide-react";
import type { NavSection } from "@/core/module-registry";
import { logoutAction } from "@/modules/users/actions";
import { NavSectionGroups } from "./nav-section-groups";

export function MobileNav({
  sections,
  user,
}: {
  sections: NavSection[];
  user: { name: string; roleName: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buka menu navigasi"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
      >
        <Menu aria-hidden="true" size={20} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu navigasi"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div className="absolute inset-y-0 right-0 flex w-80 max-w-[85%] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Menu</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <nav
              aria-label="Navigasi utama"
              className="flex-1 space-y-3 overflow-y-auto px-3 py-4"
            >
              <Suspense
                fallback={
                  <div className="space-y-3 px-3" aria-hidden="true">
                    {sections.map((section) => (
                      <div
                        key={section.label}
                        className="h-10 animate-pulse rounded-lg bg-slate-100"
                      />
                    ))}
                  </div>
                }
              >
                <NavSectionGroups
                  sections={sections}
                  idPrefix="mobile-nav"
                  onNavigate={() => setOpen(false)}
                  mobile
                />
              </Suspense>
            </nav>

            <div className="border-t border-slate-200 p-4">
              <p className="truncate text-sm font-semibold text-slate-900">
                {user.name}
              </p>
              <p className="truncate text-xs text-slate-500">{user.roleName}</p>
              <div className="mt-3 space-y-1">
                <Link
                  href="/ganti-password"
                  onClick={() => setOpen(false)}
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
          </div>
        </div>
      ) : null}
    </>
  );
}
