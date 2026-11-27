import type { SessionUser } from "@/types/database";
export interface DelegatedAccess {
  roleName: string;
  permissions: string[];
  scopeAll: boolean;
  brandIds: number[];
}
export function isGlobalSuperAdmin(actor: SessionUser): boolean {
  return actor.roleName === "Super Admin" && actor.scopeAll;
}
export function assertDelegatedAccess(
  actor: SessionUser,
  access: DelegatedAccess,
): void {
  if (isGlobalSuperAdmin(actor)) return;
  if (
    access.roleName === "Super Admin" ||
    access.permissions.some((code) => !actor.permissions.includes(code)) ||
    (!actor.scopeAll &&
      (access.scopeAll ||
        access.brandIds.some((id) => !actor.brandIds.includes(id))))
  )
    throw new Error(
      "Tidak dapat mengelola atau memberikan hak akses yang lebih tinggi atau di luar brand Anda.",
    );
}
