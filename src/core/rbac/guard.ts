import { cache } from "react";
import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "../db";
import { requireStaffSession } from "../auth/session";
import type { SessionUser } from "@/types/database";

export class ForbiddenError extends Error {
  constructor(message = "Anda tidak memiliki izin untuk melakukan aksi ini.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class FeatureDisabledError extends ForbiddenError {
  constructor(featureKey: string) {
    super(`Fitur "${featureKey}" sedang dinonaktifkan.`);
    this.name = "FeatureDisabledError";
  }
}

export function hasPermission(user: SessionUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

export function assertPermission(user: SessionUser, permission: string): void {
  if (!hasPermission(user, permission)) {
    throw new ForbiddenError();
  }
}

export async function requirePermission(permission: string): Promise<SessionUser> {
  const user = await requireStaffSession();
  assertPermission(user, permission);
  return user;
}

export async function requireAnyPermission(
  permissions: readonly string[],
): Promise<SessionUser> {
  const user = await requireStaffSession();

  if (!permissions.some((permission) => hasPermission(user, permission))) {
    throw new ForbiddenError();
  }

  return user;
}

interface FeatureFlagStateRow extends RowDataPacket {
  is_enabled: 0 | 1;
}

const loadFeatureFlag = cache(async (featureKey: string): Promise<boolean> => {
  const rows = await queryRows<FeatureFlagStateRow>(
    "SELECT is_enabled FROM feature_flags WHERE feature_key = ? LIMIT 1",
    [featureKey],
  );

  // Unknown flags are treated as disabled (deny by default).
  return rows[0]?.is_enabled === 1;
});

export async function isFeatureEnabled(featureKey: string): Promise<boolean> {
  return loadFeatureFlag(featureKey);
}

export async function requireFeatureEnabled(featureKey: string): Promise<void> {
  if (!(await loadFeatureFlag(featureKey))) {
    throw new FeatureDisabledError(featureKey);
  }
}
