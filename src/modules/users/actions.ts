"use server";

import { assertManageUser, assertRoleAssignment } from "./delegation";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeSql, withTransaction } from "@/core/db";
import { AUDIT_ACTIONS, getClientIp, logAudit } from "@/core/audit/log";
import {
  createStaffSession,
  destroyStaffSession,
  getSessionUser,
  requireStaffSession,
} from "@/core/auth/session";
import { hashPassword, verifyPassword } from "@/core/auth/password";
import { consumeRateLimit, rateLimitKey } from "@/core/auth/rate-limit";
import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  firstIssueMessage,
  redirectWithMessage,
  sanitizeNextPath,
} from "@/core/http/navigation";
import {
  changePasswordSchema,
  loginSchema,
  resetPasswordSchema,
  revokeSessionsSchema,
  userCreateSchema,
  userUpdateSchema,
  type ChangePasswordState,
  type LoginActionState,
} from "./schema";
import {
  countActiveSuperAdmins,
  existingBrandIds,
  findUserById,
  findUserForLogin,
  findUserSecurityState,
  roleExists,
} from "./queries";

const USERS_PATH = "/settings/users";
const LOGIN_WINDOW_SECONDS = 15 * 60;

let dummyHashPromise: Promise<string> | undefined;

/** Equalizes timing when the email does not exist. */
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomUUID());
  return dummyHashPromise;
}

async function requestIp(): Promise<string | null> {
  try {
    return getClientIp(await headers());
  } catch {
    return null;
  }
}

function fail(path: string, message: string): never {
  return redirectWithMessage(path, "error", message);
}

function done(path: string, message: string): never {
  return redirectWithMessage(path, "ok", message);
}

function duplicateMessage(error: unknown, fallback: string): string {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: string }).code
      : undefined;

  return code === "ER_DUP_ENTRY" ? fallback : "Gagal menyimpan data pengguna.";
}

export async function loginAction(
  _previous: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Email atau password tidak valid." };
  }

  const ip = await requestIp();
  const ipLimit = await consumeRateLimit({
    key: rateLimitKey("login:ip", ip ?? "unknown"),
    limit: 10,
    windowSeconds: LOGIN_WINDOW_SECONDS,
  });
  const emailLimit = await consumeRateLimit({
    key: rateLimitKey("login:email", parsed.data.email),
    limit: 5,
    windowSeconds: LOGIN_WINDOW_SECONDS,
  });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    await logAudit({
      userId: null,
      action: AUDIT_ACTIONS.loginFailed,
      entityType: "auth",
      details: { reason: "rate_limited" },
      ipAddress: ip,
    });

    return {
      status: "error",
      message:
        "Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.",
    };
  }

  const user = await findUserForLogin(parsed.data.email);
  const passwordMatches = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? (await getDummyHash()),
  );

  if (!user || !passwordMatches || !user.isActive) {
    await logAudit({
      userId: user?.id ?? null,
      action: AUDIT_ACTIONS.loginFailed,
      entityType: "auth",
      details: {
        reason: !user
          ? "unknown_email"
          : !user.isActive
            ? "inactive"
            : "bad_password",
      },
      ipAddress: ip,
    });

    return { status: "error", message: "Email atau password salah." };
  }

  await executeSql("UPDATE users SET last_login_at = NOW() WHERE id = ?", [
    user.id,
  ]);
  await createStaffSession(user.id, user.sessionVersion);
  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.loginSuccess,
    entityType: "auth",
    ipAddress: ip,
  });

  redirect(sanitizeNextPath(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();

  if (user) {
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.logout,
      entityType: "auth",
    });
  }

  await destroyStaffSession();
  redirect("/login");
}

type PasswordChangeResult =
  { ok: true; nextVersion: number } | { ok: false; message: string };

export async function changePasswordAction(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireStaffSession();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  const attempt = await consumeRateLimit({
    key: rateLimitKey("password-change:user", String(user.id)),
    limit: 5,
    windowSeconds: LOGIN_WINDOW_SECONDS,
  });
  if (!attempt.allowed)
    return {
      status: "error",
      message:
        "Terlalu banyak percobaan ganti password. Coba lagi dalam beberapa menit.",
    };

  const result = await withTransaction<PasswordChangeResult>(
    async (connection) => {
      const [rows] = await connection.execute<
        Array<
          RowDataPacket & { password_hash: string; session_version: number }
        >
      >(
        "SELECT password_hash, session_version FROM users WHERE id = ? FOR UPDATE",
        [user.id],
      );

      const row = rows[0];

      if (!row) {
        return { ok: false, message: "Akun tidak ditemukan." };
      }

      if (
        !(await verifyPassword(parsed.data.currentPassword, row.password_hash))
      ) {
        return { ok: false, message: "Password saat ini tidak sesuai." };
      }

      const nextVersion = row.session_version + 1;
      const passwordHash = await hashPassword(parsed.data.newPassword);

      await connection.execute(
        "UPDATE users SET password_hash = ?, session_version = ? WHERE id = ?",
        [passwordHash, nextVersion, user.id],
      );

      return { ok: true, nextVersion };
    },
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  await createStaffSession(user.id, result.nextVersion);
  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.passwordChange,
    entityType: "user",
    entityId: user.id,
  });

  return {
    status: "success",
    message: "Password berhasil diperbarui. Sesi lain telah dicabut.",
  };
}

export async function createUserAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.userManage);
  const parsed = userCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
    scopeAll: formData.get("scopeAll"),
    brandIds: formData.getAll("brandIds"),
  });

  if (!parsed.success) {
    fail(USERS_PATH, firstIssueMessage(parsed.error));
  }

  if (!(await roleExists(parsed.data.roleId))) {
    fail(USERS_PATH, "Peran yang dipilih tidak ditemukan.");
  }

  const validBrandIds = parsed.data.scopeAll
    ? []
    : await existingBrandIds(parsed.data.brandIds);

  if (
    !parsed.data.scopeAll &&
    validBrandIds.length !== parsed.data.brandIds.length
  ) {
    fail(USERS_PATH, "Sebagian brand yang dipilih tidak valid.");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  let createdUserId = 0;

  try {
    createdUserId = await withTransaction(async (connection) => {
      await assertRoleAssignment(
        connection,
        actor,
        parsed.data.roleId,
        parsed.data.scopeAll,
        validBrandIds,
      );
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO users (role_id, name, email, password_hash, scope_all)
         VALUES (?, ?, ?, ?, ?)`,
        [
          parsed.data.roleId,
          parsed.data.name,
          parsed.data.email,
          passwordHash,
          parsed.data.scopeAll,
        ],
      );

      for (const brandId of validBrandIds) {
        await connection.execute(
          "INSERT INTO user_brand_access (user_id, brand_id) VALUES (?, ?)",
          [result.insertId, brandId],
        );
      }

      return result.insertId;
    });
  } catch (error) {
    fail(
      USERS_PATH,
      duplicateMessage(error, "Email sudah digunakan oleh pengguna lain."),
    );
  }

  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.userCreate,
    entityType: "user",
    entityId: createdUserId,
    details: {
      email: parsed.data.email,
      roleId: parsed.data.roleId,
      scopeAll: parsed.data.scopeAll,
      brandIds: validBrandIds,
    },
  });

  done(USERS_PATH, "Pengguna berhasil ditambahkan.");
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.userManage);
  const parsed = userUpdateSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    scopeAll: formData.get("scopeAll"),
    isActive: formData.get("isActive"),
    brandIds: formData.getAll("brandIds"),
  });

  if (!parsed.success) {
    fail(USERS_PATH, firstIssueMessage(parsed.error));
  }

  const target = await findUserSecurityState(parsed.data.userId);

  if (!target) {
    fail(USERS_PATH, "Pengguna tidak ditemukan.");
  }

  if (parsed.data.userId === actor.id && !parsed.data.isActive) {
    fail(USERS_PATH, "Anda tidak dapat menonaktifkan akun sendiri.");
  }

  const keepsSuperAdminRole =
    target.roleName === "Super Admin" &&
    parsed.data.roleId === target.roleId &&
    parsed.data.isActive;

  if (target.roleName === "Super Admin" && !keepsSuperAdminRole) {
    const remaining = await countActiveSuperAdmins(parsed.data.userId);

    if (remaining === 0) {
      fail(
        USERS_PATH,
        "Minimal harus ada satu Super Admin aktif. Tetapkan Super Admin lain terlebih dahulu.",
      );
    }
  }

  if (!(await roleExists(parsed.data.roleId))) {
    fail(USERS_PATH, "Peran yang dipilih tidak ditemukan.");
  }

  const validBrandIds = parsed.data.scopeAll
    ? []
    : await existingBrandIds(parsed.data.brandIds);

  if (
    !parsed.data.scopeAll &&
    validBrandIds.length !== parsed.data.brandIds.length
  ) {
    fail(USERS_PATH, "Sebagian brand yang dipilih tidak valid.");
  }

  try {
    await withTransaction(async (connection) => {
      const current = await assertManageUser(
        connection,
        actor,
        parsed.data.userId,
      );
      await assertRoleAssignment(
        connection,
        actor,
        parsed.data.roleId,
        parsed.data.scopeAll,
        validBrandIds,
      );
      if (
        current.role_name === "Super Admin" &&
        (current.role_id !== parsed.data.roleId || !parsed.data.isActive)
      ) {
        const [remaining] = await connection.execute<RowDataPacket[]>(
          "SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='Super Admin' AND u.is_active=1 AND u.id<>? FOR UPDATE",
          [parsed.data.userId],
        );
        if (!remaining.length)
          throw new Error("Minimal harus ada satu Super Admin aktif.");
      }
      await connection.execute(
        `UPDATE users
         SET role_id = ?, name = ?, email = ?, scope_all = ?, is_active = ?,
             session_version = session_version + 1
         WHERE id = ?`,
        [
          parsed.data.roleId,
          parsed.data.name,
          parsed.data.email,
          parsed.data.scopeAll,
          parsed.data.isActive,
          parsed.data.userId,
        ],
      );

      await connection.execute(
        "DELETE FROM user_brand_access WHERE user_id = ?",
        [parsed.data.userId],
      );

      for (const brandId of validBrandIds) {
        await connection.execute(
          "INSERT INTO user_brand_access (user_id, brand_id) VALUES (?, ?)",
          [parsed.data.userId, brandId],
        );
      }
    });
  } catch (error) {
    fail(
      USERS_PATH,
      duplicateMessage(error, "Email sudah digunakan oleh pengguna lain."),
    );
  }

  await logAudit({
    userId: actor.id,
    action: parsed.data.isActive
      ? AUDIT_ACTIONS.userUpdate
      : AUDIT_ACTIONS.userDeactivate,
    entityType: "user",
    entityId: parsed.data.userId,
    details: {
      email: parsed.data.email,
      roleId: parsed.data.roleId,
      scopeAll: parsed.data.scopeAll,
      isActive: parsed.data.isActive,
      brandIds: validBrandIds,
    },
  });

  if (parsed.data.isActive) {
    done(USERS_PATH, "Data pengguna berhasil diperbarui.");
  }

  done(USERS_PATH, "Pengguna dinonaktifkan dan sesinya dicabut.");
}

export async function resetUserPasswordAction(
  formData: FormData,
): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.userManage);
  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) {
    fail(USERS_PATH, firstIssueMessage(parsed.error));
  }

  const target = await findUserById(parsed.data.userId);

  if (!target) {
    fail(USERS_PATH, "Pengguna tidak ditemukan.");
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await withTransaction(async (connection) => {
    await assertManageUser(connection, actor, parsed.data.userId);
    await connection.execute(
      "UPDATE users SET password_hash=?, session_version=session_version+1 WHERE id=?",
      [passwordHash, parsed.data.userId],
    );
  });

  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.userPasswordReset,
    entityType: "user",
    entityId: parsed.data.userId,
    details: { email: target.name },
  });

  if (parsed.data.userId === actor.id) {
    await destroyStaffSession();
    done("/login", "Password Anda direset. Silakan login kembali.");
  }

  done(
    USERS_PATH,
    `Password ${target.name} direset dan semua sesinya dicabut.`,
  );
}

export async function revokeUserSessionsAction(
  formData: FormData,
): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.userManage);
  const parsed = revokeSessionsSchema.safeParse({
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    fail(USERS_PATH, firstIssueMessage(parsed.error));
  }

  const target = await findUserById(parsed.data.userId);

  if (!target) {
    fail(USERS_PATH, "Pengguna tidak ditemukan.");
  }

  await withTransaction(async (connection) => {
    await assertManageUser(connection, actor, parsed.data.userId);
    await connection.execute(
      "UPDATE users SET session_version=session_version+1 WHERE id=?",
      [parsed.data.userId],
    );
  });

  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.userSessionsRevoked,
    entityType: "user",
    entityId: parsed.data.userId,
  });

  if (parsed.data.userId === actor.id) {
    await destroyStaffSession();
    done("/login", "Sesi Anda telah dicabut. Silakan login kembali.");
  }

  done(USERS_PATH, `Semua sesi ${target.name} telah dicabut.`);
}
