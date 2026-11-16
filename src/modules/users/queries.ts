import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import type { RoleRow, UserListRow } from "@/types/database";

interface CountTotalRow extends RowDataPacket {
  total: number;
}

interface BrandNameRow extends RowDataPacket {
  user_id: number;
  name: string;
}

interface BrandIdRow extends RowDataPacket {
  user_id: number;
  brand_id: number;
}

interface RoleSelectRow extends RowDataPacket {
  id: number;
  name: string;
}

export interface RoleOption {
  id: number;
  name: string;
}

export interface UserLoginRow {
  id: number;
  passwordHash: string;
  sessionVersion: number;
  isActive: boolean;
}

export interface UserListResult {
  users: UserListRow[];
  total: number;
  brandNames: Map<number, string[]>;
  brandIds: Map<number, number[]>;
}

export interface UserSecurityState {
  roleId: number;
  roleName: string;
  isActive: boolean;
  scopeAll: boolean;
}

export async function listUsers(options: {
  search: string;
  page: number;
  pageSize: number;
}): Promise<UserListResult> {
  const search = options.search.trim();
  const term = `%${search}%`;
  const where = search ? "WHERE u.name LIKE ? OR u.email LIKE ?" : "";
  const filters: (string | number)[] = search ? [term, term] : [];
  const offset = (options.page - 1) * options.pageSize;

  const users = await queryRows<UserListRow>(
    `SELECT u.id, u.name, u.email, u.role_id, r.name AS role_name,
            u.scope_all, u.is_active, u.last_login_at, u.created_at
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     ${where}
     ORDER BY u.name ASC
     LIMIT ? OFFSET ?`,
    [...filters, options.pageSize, offset],
  );

  const totalRows = await queryRows<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM users u ${where}`,
    filters,
  );

  const brandNames = new Map<number, string[]>();
  const brandIds = new Map<number, number[]>();
  const ids = users.map((user) => user.id);

  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(", ");

    const nameRows = await queryRows<BrandNameRow>(
      `SELECT ub.user_id, b.name
       FROM user_brand_access ub
       INNER JOIN brands b ON b.id = ub.brand_id
       WHERE ub.user_id IN (${placeholders})
       ORDER BY b.name`,
      ids,
    );

    for (const row of nameRows) {
      const list = brandNames.get(row.user_id) ?? [];
      list.push(row.name);
      brandNames.set(row.user_id, list);
    }

    const idRows = await queryRows<BrandIdRow>(
      `SELECT user_id, brand_id FROM user_brand_access
       WHERE user_id IN (${placeholders})
       ORDER BY brand_id`,
      ids,
    );

    for (const row of idRows) {
      const list = brandIds.get(row.user_id) ?? [];
      list.push(row.brand_id);
      brandIds.set(row.user_id, list);
    }
  }

  return {
    users,
    total: totalRows[0]?.total ?? 0,
    brandNames,
    brandIds,
  };
}

export async function listRoleOptions(): Promise<RoleOption[]> {
  const rows = await queryRows<RoleSelectRow>(
    "SELECT id, name FROM roles ORDER BY name",
  );

  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function findUserForLogin(email: string): Promise<UserLoginRow | null> {
  const rows = await queryRows<
    RowDataPacket & {
      id: number;
      password_hash: string;
      session_version: number;
      is_active: 0 | 1;
    }
  >(
    `SELECT id, password_hash, session_version, is_active
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email],
  );

  const row = rows[0];

  return row
    ? {
        id: row.id,
        passwordHash: row.password_hash,
        sessionVersion: row.session_version,
        isActive: row.is_active === 1,
      }
    : null;
}

export async function findUserById(
  userId: number,
): Promise<(UserLoginRow & { name: string }) | null> {
  const rows = await queryRows<
    RowDataPacket & {
      id: number;
      name: string;
      password_hash: string;
      session_version: number;
      is_active: 0 | 1;
    }
  >(
    `SELECT id, name, password_hash, session_version, is_active
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );

  const row = rows[0];

  return row
    ? {
        id: row.id,
        name: row.name,
        passwordHash: row.password_hash,
        sessionVersion: row.session_version,
        isActive: row.is_active === 1,
      }
    : null;
}

export async function findUserSecurityState(
  userId: number,
): Promise<UserSecurityState | null> {
  const rows = await queryRows<
    RowDataPacket & {
      role_id: number;
      role_name: string;
      is_active: 0 | 1;
      scope_all: 0 | 1;
    }
  >(
    `SELECT u.role_id, r.name AS role_name, u.is_active, u.scope_all
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );

  const row = rows[0];

  return row
    ? {
        roleId: row.role_id,
        roleName: row.role_name,
        isActive: row.is_active === 1,
        scopeAll: row.scope_all === 1,
      }
    : null;
}

export async function countActiveSuperAdmins(excludeUserId?: number): Promise<number> {
  const rows = await queryRows<CountTotalRow>(
    `SELECT COUNT(*) AS total
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'Super Admin' AND u.is_active = 1
       AND (? IS NULL OR u.id <> ?)`,
    [excludeUserId ?? null, excludeUserId ?? 0],
  );

  return rows[0]?.total ?? 0;
}

export async function userIsSuperAdmin(userId: number): Promise<boolean> {
  const state = await findUserSecurityState(userId);
  return state?.roleName === "Super Admin";
}

export async function roleExists(roleId: number): Promise<boolean> {
  const rows = await queryRows<CountTotalRow>(
    "SELECT COUNT(*) AS total FROM roles WHERE id = ?",
    [roleId],
  );

  return (rows[0]?.total ?? 0) > 0;
}

export async function existingBrandIds(brandIds: number[]): Promise<number[]> {
  if (brandIds.length === 0) {
    return [];
  }

  const placeholders = brandIds.map(() => "?").join(", ");
  const rows = await queryRows<RowDataPacket & { id: number }>(
    `SELECT id FROM brands WHERE id IN (${placeholders})`,
    brandIds,
  );

  return rows.map((row) => row.id);
}

export async function listRolesForAdmin(): Promise<RoleRow[]> {
  return queryRows<RoleRow>(
    `SELECT id, name, description, is_system, created_at, updated_at
     FROM roles
     ORDER BY is_system DESC, name`,
  );
}