"use server";

import type { ResultSetHeader } from "mysql2/promise";
import { executeSql, withTransaction } from "@/core/db";
import { AUDIT_ACTIONS, logAudit } from "@/core/audit/log";
import { firstIssueMessage, redirectWithMessage } from "@/core/http/navigation";
import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  roleCreateSchema,
  roleDeleteSchema,
  rolePermissionsSchema,
  roleUpdateSchema,
} from "./schema";
import {
  countExistingPermissions,
  countUsersInRole,
  getRoleById,
} from "./queries";

const ROLES_PATH = "/settings/roles";

function fail(message: string): never {
  return redirectWithMessage(ROLES_PATH, "error", message);
}

function done(message: string): never {
  return redirectWithMessage(ROLES_PATH, "ok", message);
}

function duplicateMessage(error: unknown, fallback: string): string {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: string }).code
      : undefined;

  return code === "ER_DUP_ENTRY" ? fallback : "Gagal menyimpan peran.";
}

export async function createRoleAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.roleManage);
  const parsed = roleCreateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    permissionIds: formData.getAll("permissionIds"),
  });

  if (!parsed.success) {
    fail(firstIssueMessage(parsed.error));
  }

  const permissionIds = [...new Set(parsed.data.permissionIds)];

  if ((await countExistingPermissions(permissionIds)) !== permissionIds.length) {
    fail("Sebagian izin yang dipilih tidak valid.");
  }

  let roleId = 0;

  try {
    roleId = await withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO roles (name, description, is_system) VALUES (?, ?, FALSE)",
        [parsed.data.name, parsed.data.description],
      );

      for (const permissionId of permissionIds) {
        await connection.execute(
          "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
          [result.insertId, permissionId],
        );
      }

      return result.insertId;
    });
  } catch (error) {
    fail(duplicateMessage(error, "Nama peran sudah digunakan."));
  }

  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.roleCreate,
    entityType: "role",
    entityId: roleId,
    details: { name: parsed.data.name, permissionCount: permissionIds.length },
  });

  done("Peran baru berhasil dibuat.");
}

export async function updateRoleAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.roleManage);
  const parsed = roleUpdateSchema.safeParse({
    roleId: formData.get("roleId"),
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    fail(firstIssueMessage(parsed.error));
  }

  const role = await getRoleById(parsed.data.roleId);

  if (!role) {
    fail("Peran tidak ditemukan.");
  }

  if (role.isSystem && role.name !== parsed.data.name) {
    fail("Nama peran sistem tidak dapat diubah. Ubah deskripsi atau izinnya saja.");
  }

  try {
    await executeSql("UPDATE roles SET name = ?, description = ? WHERE id = ?", [
      parsed.data.name,
      parsed.data.description,
      parsed.data.roleId,
    ]);
  } catch (error) {
    fail(duplicateMessage(error, "Nama peran sudah digunakan."));
  }

  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.roleUpdate,
    entityType: "role",
    entityId: parsed.data.roleId,
    details: { name: parsed.data.name },
  });

  done("Peran berhasil diperbarui.");
}

export async function updateRolePermissionsAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.roleManage);
  const parsed = rolePermissionsSchema.safeParse({
    roleId: formData.get("roleId"),
    permissionIds: formData.getAll("permissionIds"),
  });

  if (!parsed.success) {
    fail(firstIssueMessage(parsed.error));
  }

  const role = await getRoleById(parsed.data.roleId);

  if (!role) {
    fail("Peran tidak ditemukan.");
  }

  if (role.name === "Super Admin") {
    fail("Izin Super Admin dikunci penuh dan tidak dapat diubah.");
  }

  const permissionIds = [...new Set(parsed.data.permissionIds)];

  if ((await countExistingPermissions(permissionIds)) !== permissionIds.length) {
    fail("Sebagian izin yang dipilih tidak valid.");
  }

  await withTransaction(async (connection) => {
    await connection.execute("DELETE FROM role_permissions WHERE role_id = ?", [
      role.id,
    ]);

    for (const permissionId of permissionIds) {
      await connection.execute(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
        [role.id, permissionId],
      );
    }
  });

  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.rolePermissionsUpdate,
    entityType: "role",
    entityId: role.id,
    details: { name: role.name, permissionCount: permissionIds.length },
  });

  done(`Izin peran ${role.name} berhasil diperbarui.`);
}

export async function deleteRoleAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.roleManage);
  const parsed = roleDeleteSchema.safeParse({
    roleId: formData.get("roleId"),
  });

  if (!parsed.success) {
    fail(firstIssueMessage(parsed.error));
  }

  const role = await getRoleById(parsed.data.roleId);

  if (!role) {
    fail("Peran tidak ditemukan.");
  }

  if (role.isSystem) {
    fail("Peran sistem tidak dapat dihapus.");
  }

  const userCount = await countUsersInRole(role.id);

  if (userCount > 0) {
    fail(`Peran ${role.name} masih dipakai oleh ${userCount} pengguna. Pindahkan pengguna terlebih dahulu.`);
  }

  await executeSql("DELETE FROM roles WHERE id = ?", [role.id]);

  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.roleDelete,
    entityType: "role",
    entityId: role.id,
    details: { name: role.name },
  });

  done(`Peran ${role.name} berhasil dihapus.`);
}