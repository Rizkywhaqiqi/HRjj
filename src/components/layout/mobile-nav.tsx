"use client";
import { MotionPreference } from "@/components/motion/motion-preference";

import { SubmitButton } from "@/components/ui/form";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, LogOut, Menu, X } from "lucide-react";
import type { NavSection } from "@/core/module-registry";
import { logoutAction } from "@/modules/users/actions";
import { BrandLogo } from "@/components/ui/brand-logo";
import { NavSectionGroups } from "./nav-section-groups";

export function MobileNav({
  sections,
  user,
}: {
  sections: NavSection[];
  user: { name: string; roleName: string };
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const dialogId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (!dialog) return;
    // Native modal dialogs escape the sticky header's backdrop-filter stacking
    // context and provide focus containment, Escape, and an inert background.
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = () => setOpen(false);
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => {
      if (desktop.matches) close();
    };
    desktop.addEventListener("change", onResize);
    window.addEventListener("popstate", close);
    return () => {
      desktop.removeEventListener("change", onResize);
      window.removeEventListener("popstate", close);
      document.body.style.overflow = previousOverflow;
      dialog.close();
      if (!desktop.matches) trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buka menu navigasi"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <Menu aria-hidden="true" size={22} />
      </button>
      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            setOpen(false);
        }}
        className="mobile-navigation fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(24rem,calc(100vw-1rem))] max-w-none flex-col border-0 bg-white p-0 text-slate-900 shadow-2xl open:flex lg:hidden"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo className="w-16" sizes="64px" />
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-bold tracking-tight">
                Menu navigasi
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">JOJO HR Space</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <X aria-hidden="true" size={21} />
          </button>
        </div>
        <nav
          aria-label="Navigasi utama mobile"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4"
        >
          {open ? (
            <Suspense
              fallback={
                <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
              }
            >
              <NavSectionGroups
                sections={sections}
                idPrefix="mobile-nav"
                onNavigate={() => setOpen(false)}
                mobile
              />
            </Suspense>
          ) : null}
        </nav>
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800"
            >
              {user.name.trim().slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.roleName}</p>
            </div>
            <MotionPreference compact />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/ganti-password"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <KeyRound aria-hidden="true" size={16} />
              Ganti password
            </Link>
            <form action={logoutAction}>
              <SubmitButton
                unstyled
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-rose-600"
              >
                <LogOut aria-hidden="true" size={16} />
                Keluar
              </SubmitButton>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
