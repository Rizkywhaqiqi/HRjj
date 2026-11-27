"use client";
import { matchesNavigation } from "@/core/navigation";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { NavSection } from "@/core/module-registry";
import { NavIcon } from "@/components/ui/nav-icon";

export function NavSectionGroups({
  sections,
  idPrefix,
  onNavigate,
  mobile = false,
}: {
  sections: NavSection[];
  idPrefix: string;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const activeHref = sections
    .flatMap((section) => section.items)
    .filter((item) => matchesNavigation(item.href, pathname, search))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;
  const activeSection = sections.find((section) =>
    section.items.some((item) => item.href === activeHref),
  )?.label;

  return (
    <>
      {sections.map((section, index) => (
        <NavSectionGroup
          key={`${section.label}-${pathname}-${search}`}
          section={section}
          sectionId={`${idPrefix}-${index}`}
          activeHref={activeHref}
          isActiveSection={section.label === activeSection}
          onNavigate={onNavigate}
          mobile={mobile}
        />
      ))}
    </>
  );
}

function NavSectionGroup({
  section,
  sectionId,
  activeHref,
  isActiveSection,
  onNavigate,
  mobile,
}: {
  section: NavSection;
  sectionId: string;
  activeHref: string | undefined;
  isActiveSection: boolean;
  onNavigate?: () => void;
  mobile: boolean;
}) {
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? isActiveSection;

  return (
    <section>
      {section.standalone ? null : (
        <button
          type="button"
          aria-label={section.label}
          aria-expanded={open}
          aria-controls={`${sectionId}-items`}
          onClick={() => setOpenOverride(!open)}
          className={`flex w-full items-center gap-2 rounded-lg px-3 ${
            mobile ? "min-h-11 py-3" : "min-h-11 py-2"
          } text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
            isActiveSection
              ? "text-brand-700"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <span>{section.label}</span>
          <span
            aria-hidden="true"
            className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6rem] text-slate-500"
          >
            {section.items.length}
          </span>
          <ChevronDown
            aria-hidden="true"
            size={14}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
      <ul
        id={`${sectionId}-items`}
        hidden={!section.standalone && !open}
        className={
          section.standalone
            ? "space-y-1"
            : "ml-3 mt-1 space-y-1 border-l border-slate-200 pl-2"
        }
      >
        {section.items.map((item) => {
          const isActive = item.href === activeHref;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 ${
                  mobile ? "min-h-11 py-3" : "min-h-11 py-2"
                } text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 ${
                  isActive
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <NavIcon name={item.icon} />
                <span className="min-w-0 break-words">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
