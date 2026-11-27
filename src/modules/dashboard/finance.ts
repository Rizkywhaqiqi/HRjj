import type { SessionUser } from "@/types/database";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { directBrandScope } from "@/core/rbac/scope";
import type { SqlParams } from "@/core/db";
export interface FinanceFilters {
  search: string;
  brandId?: number;
  companyId?: number;
  missingCompany: boolean;
  status: "active" | "inactive" | "all";
}
export function canViewFinanceDirectory(user: SessionUser): boolean {
  return (
    user.permissions.includes(PERMISSIONS.employeeView) ||
    user.permissions.includes(PERMISSIONS.reportView)
  );
}
export function financeFilters(
  params: Record<string, string | string[] | undefined>,
): FinanceFilters {
  const value = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const id = (key: string) => {
    const n = Number(value(key));
    return Number.isSafeInteger(n) && n > 0 ? n : undefined;
  };
  const status = value("financeStatus");
  return {
    search: value("financeSearch").trim().replace(/\s+/g, " ").slice(0, 80),
    brandId: id("financeBrand"),
    companyId: id("financeCompany"),
    missingCompany: value("financeCompany") === "missing",
    status: status === "all" || status === "inactive" ? status : "active",
  };
}
export function financeFilterQuery(
  filters: FinanceFilters,
): Record<string, string | undefined> {
  return {
    financeSearch: filters.search || undefined,
    financeBrand: filters.brandId ? String(filters.brandId) : undefined,
    financeCompany: filters.missingCompany
      ? "missing"
      : filters.companyId
        ? String(filters.companyId)
        : undefined,
    financeStatus: filters.status,
  };
}
export function financeWhere(
  user: SessionUser,
  filters: FinanceFilters,
): { clause: string; params: SqlParams } {
  const scope = directBrandScope(user, "e.brand_id");
  const clauses = [scope.clause];
  const params: SqlParams = [...scope.params];
  if (!canViewFinanceDirectory(user)) clauses.push("1 = 0");
  if (filters.status !== "all") {
    clauses.push("e.is_active = ?");
    params.push(filters.status === "active");
  }
  if (filters.brandId) {
    clauses.push("e.brand_id = ?");
    params.push(filters.brandId);
  }
  if (filters.missingCompany) clauses.push("e.company_id IS NULL");
  else if (filters.companyId) {
    clauses.push("e.company_id = ?");
    params.push(filters.companyId);
  }
  if (filters.search) {
    if (filters.search.length < 2) clauses.push("1 = 0");
    else {
      const term = filters.search.replace(/[\\%_]/g, "\\$&") + "%";
      clauses.push("(e.full_name LIKE ? OR e.employee_code LIKE ?)");
      params.push(term, term);
    }
  }
  return { clause: clauses.join(" AND "), params };
}
