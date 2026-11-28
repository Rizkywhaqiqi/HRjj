"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
const KEY = "hr-workspace-motion";
const EVENT = "hr-workspace-motion-change";
let fallback = true;
let sessionPreference: boolean | undefined;
function subscribe(listener: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  media.addEventListener("change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
    media.removeEventListener("change", listener);
  };
}
function snapshot(): "on" | "off" | "reduced" {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return "reduced";
  if (sessionPreference !== undefined) return sessionPreference ? "on" : "off";
  try {
    return window.localStorage.getItem(KEY) === "off" ? "off" : "on";
  } catch {
    return fallback ? "on" : "off";
  }
}
export function MotionPreference({ compact = false }: { compact?: boolean }) {
  const state = useSyncExternalStore(subscribe, snapshot, () => "on" as const);
  const enabled = state === "on";
  useEffect(() => {
    document.documentElement.dataset.workspaceMotion = enabled ? "on" : "off";
  }, [enabled]);
  const label =
    state === "reduced"
      ? "Animasi mengikuti pengaturan kurangi gerakan perangkat"
      : enabled
        ? "Nonaktifkan animasi"
        : "Aktifkan animasi";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={enabled}
      disabled={state === "reduced"}
      onClick={() => {
        fallback = !enabled;
        try {
          window.localStorage.setItem(KEY, fallback ? "on" : "off");
          sessionPreference = undefined;
        } catch {
          sessionPreference =
            fallback; /* Preference still works for this session when storage is unavailable. */
        }
        window.dispatchEvent(new Event(EVENT));
      }}
      className={`motion-preference inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:opacity-60 ${compact ? "h-11 w-11 shrink-0 justify-center" : "w-full px-2 py-2"}`}
    >
      <Sparkles
        size={16}
        aria-hidden="true"
        className={enabled ? "text-brand-600" : "text-slate-400"}
      />
      {!compact && <span>Animasi {enabled ? "aktif" : "nonaktif"}</span>}
    </button>
  );
}
