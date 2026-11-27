import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { SessionUser } from "@/types/database";
import { assertDelegatedAccess } from "@/core/rbac/delegation";

export async function assertRoleAssignment(
  connection: PoolConnection,
  actor: SessionUser,
  roleId: number,
  scopeAll: boolean,
  brandIds: number[],
): Promise<void> {
  const [roles] = await connection.execute<RowDataPacket[]>(
    "SELECT name FROM roles WHERE id=? FOR UPDATE",
    [roleId],
  );
  if (!roles[0]) throw new Error("Peran tidak ditemukan.");
  const [permissions] = await connection.execute<RowDataPacket[]>(
    "SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=?",
    [roleId],
  );
  assertDelegatedAccess(actor, {
    roleName: roles[0].name,
    permissions: permissions.map((p) => String(p.code)),
    scopeAll,
    brandIds,
  });
}
export async function assertManageUser(
  connection: PoolConnection,
  actor: SessionUser,
  userId: number,
) {
  const [users] = await connection.execute<RowDataPacket[]>(
    "SELECT u.role_id,u.scope_all,r.name role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=? FOR UPDATE",
    [userId],
  );
  if (!users[0]) throw new Error("Pengguna tidak ditemukan.");
  const [brands] = await connection.execute<RowDataPacket[]>(
    "SELECT brand_id FROM user_brand_access WHERE user_id=?",
    [userId],
  );
  await assertRoleAssignment(
    connection,
    actor,
    users[0].role_id,
    Boolean(users[0].scope_all),
    brands.map((b) => Number(b.brand_id)),
  );
  return users[0];
}
