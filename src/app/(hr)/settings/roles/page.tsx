import { hasPermission, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listPermissionCatalog, listRolePermissionMap, listRolesWithCounts } from "@/modules/roles";
import { Card, CardBody, EmptyState, PageHeader, Badge } from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import { groupPermissions, moduleLabel, RoleCreateForm, RoleManageForm } from "./role-forms";

export const instant = false;

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.roleView);
  const [roles, permissions, permissionMap, params] = await Promise.all([
    listRolesWithCounts(),
    listPermissionCatalog(),
    listRolePermissionMap(),
    searchParams,
  ]);
  const canManage = hasPermission(actor, PERMISSIONS.roleManage);
  const permissionGroups = groupPermissions(permissions);

  return (
    <div>
      <PageHeader
        title="Peran & izin"
        description="Kelola peran sistem dan izin akses aplikasi secara terpusat."
      />
      <FlashAlerts {...readFlash(params)} />
      {canManage ? <div className="mb-5"><RoleCreateForm permissions={permissions} /></div> : null}
      <Card className="mb-5">
        <CardBody>
          <div className="space-y-3">
            <div>
              <h2 className="font-semibold text-slate-900">Modul tersedia</h2>
              <p className="text-xs text-slate-500">
                {permissionGroups.length} modul · {permissions.length} izin dapat diatur pada peran.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {permissionGroups.map((group) => (
                <li
                  key={group.module}
                  className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {moduleLabel(group.module)}
                  <Badge tone="neutral">{group.items.length} izin</Badge>
                </li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          {roles.length === 0 ? (
            <EmptyState title="Belum ada peran" description="Seed database terlebih dahulu untuk membuat peran awal." />
          ) : (
            <ul className="space-y-3">
              {roles.map((role) => (
                <li key={role.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{role.name}</p>
                      <p className="text-xs text-slate-500">{role.description ?? "Tanpa deskripsi"}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {role.isSystem ? <Badge tone="brand">Sistem</Badge> : null}
                      <Badge tone="info">{role.userCount} pengguna</Badge>
                      <Badge tone="neutral">{role.permissionCount} izin</Badge>
                    </div>
                  </div>
                  {canManage ? (
                    <div className="mt-3">
                      <RoleManageForm
                        role={role}
                        permissions={permissions}
                        selectedPermissionIds={permissionMap.get(role.id) ?? []}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
