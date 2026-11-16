import type { ReactNode } from "react";
import { requireStaffSession } from "@/core/auth/session";
import { hasPermission, ForbiddenError } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { SubNav } from "@/components/layout/sub-nav";

export const instant = false;

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await requireStaffSession();

  const items = [
    hasPermission(user, PERMISSIONS.userView)
      ? { href: "/settings/users", label: "Pengguna" }
      : null,
    hasPermission(user, PERMISSIONS.roleView)
      ? { href: "/settings/roles", label: "Peran & Izin" }
      : null,
    hasPermission(user, PERMISSIONS.featureFlagManage)
      ? { href: "/settings/feature-flags", label: "Saklar Fitur" }
      : null,
    hasPermission(user, PERMISSIONS.auditView)
      ? { href: "/settings/audit-logs", label: "Audit Log" }
      : null,
  ].filter((item): item is { href: string; label: string } => item !== null);

  if (items.length === 0) {
    throw new ForbiddenError("Anda tidak memiliki akses ke menu pengaturan.");
  }

  return (
    <div>
      <SubNav items={items} />
      {children}
    </div>
  );
}
