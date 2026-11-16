import { headers } from "next/headers";
import { executeSql } from "../db";

export const AUDIT_ACTIONS = {
  loginSuccess: "auth.login.success",
  loginFailed: "auth.login.failed",
  logout: "auth.logout",
  passwordChange: "auth.password.change",
  userCreate: "user.create",
  userUpdate: "user.update",
  userActivate: "user.activate",
  userDeactivate: "user.deactivate",
  userPasswordReset: "user.password.reset",
  userSessionsRevoked: "user.sessions.revoke",
  roleCreate: "role.create",
  roleUpdate: "role.update",
  roleDelete: "role.delete",
  rolePermissionsUpdate: "role.permissions.update",
  featureFlagUpdate: "feature_flag.update",
  masterDataCreate: "master_data.create",
  masterDataUpdate: "master_data.update",
  masterDataDeactivate: "master_data.deactivate",
  masterDataDelete: "master_data.delete",
  sensitiveRead: "security.sensitive_read",
  exportData: "security.export",
  employeeCreate: "employee.create",
  employeeDeactivate: "employee.deactivate",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditLogInput {
  userId: number | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

const SENSITIVE_KEY_PATTERN =
  /(nik|npwp|rekening|bank_account|account_number|password|passphrase|secret|token|ktp|cv_file|file_path)/i;
const MAX_STRING_LENGTH = 200;
const MAX_ARRAY_LENGTH = 20;
const MAX_OBJECT_KEYS = 30;
const MAX_DEPTH = 3;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...`
      : value;
  }

  if (depth >= MAX_DEPTH) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    )) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[redacted]"
        : sanitizeValue(entry, depth + 1);
    }

    return result;
  }

  return String(value);
}

function isValidIp(value: string): boolean {
  if (value.length === 0 || value.length > 45) {
    return false;
  }

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split(".").every((part) => Number(part) <= 255);
  }

  return value.includes(":") && /^[0-9a-fA-F:.]+$/.test(value);
}

export function getClientIp(headerList: Headers): string | null {
  const forwarded = headerList.get("x-forwarded-for");
  const candidate =
    forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip")?.trim() ?? null;

  return candidate && isValidIp(candidate) ? candidate : null;
}

async function getRequestIp(): Promise<string | null> {
  try {
    return getClientIp(await headers());
  } catch {
    return null;
  }
}

/**
 * Writes an audit entry. Never throws: a failed audit write must not roll back
 * the business operation, but it is reported to the server log.
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  const details = input.details ? sanitizeValue(input.details) : null;
  const ipAddress = input.ipAddress ?? (await getRequestIp());

  try {
    await executeSql(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.userId,
        input.action,
        input.entityType,
        input.entityId === undefined || input.entityId === null
          ? null
          : String(input.entityId),
        details === null ? null : JSON.stringify(details),
        ipAddress,
      ],
    );
  } catch (error) {
    console.error("[audit] Failed to persist an audit entry.", {
      action: input.action,
      entityType: input.entityType,
      error: error instanceof Error ? error.name : "unknown error",
    });
  }
}
