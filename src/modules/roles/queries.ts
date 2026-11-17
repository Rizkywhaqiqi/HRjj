import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import type { PermissionRow } from "@/types/database";

interface CountTotalRow extends RowDataPacket {
  total: number;
}

interface RoleWithCountsRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  is_system: 0 | 1;
  user_count: number;
  permission_count: number;
}

interface RolePermissionPairRow extends RowDataPacket {
  role_id: number;
  permission_id: number;
}

export interface RoleSummary {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
}

export async function listRolesWithCounts(): Promise<RoleSummary[]> {
  const rows = await queryRows<RoleWithCountsRow>(
    `SELECT r.id, r.name, r.description, r.is_system,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count,
            (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
     FROM roles r
     ORDER BY r.is_system DESC, r.name`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.is_system === 1,
    userCount: row.user_count,
    permissionCount: row.permission_count,
  }));
}

export async function listPermissionCatalog(): Promise<PermissionRow[]> {
  return queryRows<PermissionRow>(
    `SELECT id, code, module, description
     FROM permissions WHERE module NOT IN ('recruitment','vacancy','checklist','checklists','leave','payroll','asset','assets') AND code NOT IN ('letter.approve','letter.issue')
     ORDER BY module, code`,
  );
}

export async function listRolePermissionMap(): Promise<Map<number, number[]>> {
  const rows = await queryRows<RolePermissionPairRow>(
    "SELECT role_id, permission_id FROM role_permissions ORDER BY role_id, permission_id",
  );

  const map = new Map<number, number[]>();

  for (const row of rows) {
    const list = map.get(row.role_id) ?? [];
    list.push(row.permission_id);
    map.set(row.role_id, list);
  }

  return map;
}

export async function getRoleById(
  roleId: number,
): Promise<{ id: number; name: string; isSystem: boolean } | null> {
  const rows = await queryRows<
    RowDataPacket & { id: number; name: string; is_system: 0 | 1 }
  >("SELECT id, name, is_system FROM roles WHERE id = ? LIMIT 1", [roleId]);

  const row = rows[0];

  return row
    ? { id: row.id, name: row.name, isSystem: row.is_system === 1 }
    : null;
}

export async function countUsersInRole(roleId: number): Promise<number> {
  const rows = await queryRows<CountTotalRow>(
    "SELECT COUNT(*) AS total FROM users WHERE role_id = ?",
    [roleId],
  );

  return rows[0]?.total ?? 0;
}

export async function countExistingPermissions(
  permissionIds: number[],
): Promise<number> {
  if (permissionIds.length === 0) {
    return 0;
  }

  const placeholders = permissionIds.map(() => "?").join(", ");
  const rows = await queryRows<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM permissions WHERE id IN (${placeholders})`,
    permissionIds,
  );

  return rows[0]?.total ?? 0;
}
