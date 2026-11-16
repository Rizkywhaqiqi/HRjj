import type { SqlValue } from "../db";
import { ForbiddenError } from "./guard";
import type { SessionUser } from "@/types/database";

export interface SqlScope {
  clause: string;
  params: SqlValue[];
}

const COLUMN_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;

export const ALLOW_ALL_SCOPE: SqlScope = { clause: "1 = 1", params: [] };
export const DENY_ALL_SCOPE: SqlScope = { clause: "1 = 0", params: [] };

function assertSafeColumn(column: string): string {
  if (!COLUMN_PATTERN.test(column)) {
    throw new Error(`Unsafe SQL column reference: ${column}`);
  }

  return column;
}

/**
 * Builds a brand filter for a column that stores `companies.id`.
 * Users without `scope_all` and without any brand row get a deny-all clause.
 */
export function brandScope(user: SessionUser, companyColumn: string): SqlScope {
  if (user.scopeAll) {
    return ALLOW_ALL_SCOPE;
  }

  if (user.brandIds.length === 0) {
    return DENY_ALL_SCOPE;
  }

  const column = assertSafeColumn(companyColumn);
  const placeholders = user.brandIds.map(() => "?").join(", ");

  return {
    clause: `${column} IN (SELECT id FROM companies WHERE brand_id IN (${placeholders}))`,
    params: [...user.brandIds],
  };
}

/** Builds a brand filter for a column that stores `brands.id` directly. */
export function directBrandScope(user: SessionUser, brandColumn: string): SqlScope {
  if (user.scopeAll) {
    return ALLOW_ALL_SCOPE;
  }

  if (user.brandIds.length === 0) {
    return DENY_ALL_SCOPE;
  }

  const column = assertSafeColumn(brandColumn);
  const placeholders = user.brandIds.map(() => "?").join(", ");

  return {
    clause: `${column} IN (${placeholders})`,
    params: [...user.brandIds],
  };
}

export function canAccessBrand(user: SessionUser, brandId: number): boolean {
  return user.scopeAll || user.brandIds.includes(brandId);
}

export function assertBrandAccess(user: SessionUser, brandId: number): void {
  if (!canAccessBrand(user, brandId)) {
    throw new ForbiddenError("Anda tidak memiliki akses ke brand data ini.");
  }
}
