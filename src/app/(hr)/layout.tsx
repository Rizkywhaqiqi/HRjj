import type { ReactNode } from "react";
import { requireStaffSession } from "@/core/auth/session";
import { visibleNavSections } from "@/core/module-registry";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Authenticated pages read the session cookie on every request, so this segment
 * opts out of static prerendering and streams behind the server render.
 */
export const instant = false;

export default async function HrLayout({ children }: { children: ReactNode }) {
  const user = await requireStaffSession();

  const sections = await visibleNavSections(user.permissions);

  return (
    <AppShell user={user} sections={sections}>
      {children}
    </AppShell>
  );
}
