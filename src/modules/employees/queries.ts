import { employeeSearch } from "./search";
import type { RowDataPacket } from "mysql2/promise";
import { queryRows, type SqlValue } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";
import { decryptField } from "@/core/crypto/field-encrypt";
import { logAudit } from "@/core/audit/log";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { maskSensitiveFields } from "@/core/rbac/field-mask";

export interface EmployeeListItem extends RowDataPacket {
  id: number;
  employee_code: string;
  full_name: string;
  company_id: number | null;
  company_name: string | null;
  brand_name: string;
  position_name: string;
  division_name: string;
  location_name: string;
  join_date: string | null;
  is_active: 0 | 1;
  exit_date: string | Date | null;
  service_months: number | null;
  is_profile_complete: 0 | 1;
}

export interface EmployeeDetailSummary extends RowDataPacket {
  id: number;
  employee_code: string;
  full_name: string;
  company_name: string | null;
  brand_name: string;
  position_name: string;
  division_name: string;
  location_name: string;
  location_city: string | null;
  join_date: string | Date | null;
  is_active: 0 | 1;
  exit_date: string | Date | null;
  exit_reason_name: string | null;
  service_months: number | null;
  is_profile_complete: 0 | 1;
}

export interface EmployeeListResult {
  employees: EmployeeListItem[];
  total: number;
}

export interface EmployeeListFilters {
  search?: string;
  brandId?: number;
  companyId?: number;
  divisionId?: number;
  locationId?: number;
  status?: "active" | "inactive";
  incompleteOnly?: boolean;
}

export const PROFILE_INCOMPLETE_SQL =
  "(e.company_id IS NULL OR e.nik_hash IS NULL OR e.birth_place IS NULL OR e.birth_date IS NULL OR e.address_current IS NULL OR e.address_ktp IS NULL OR e.phone IS NULL OR e.join_date IS NULL OR e.marital_status IS NULL OR e.children_count IS NULL)";

export async function getEmployeeDetailSummary(
  user: SessionUser,
  employeeId: number,
): Promise<EmployeeDetailSummary | null> {
  const scope = directBrandScope(user, "e.brand_id");
  const rows = await queryRows<EmployeeDetailSummary>(
    `SELECT e.id, e.employee_code, e.full_name, c.name AS company_name,
            b.name AS brand_name, p.name AS position_name, d.name AS division_name,
            l.name AS location_name, l.city AS location_city, e.join_date,
            e.is_active, e.exit_date, er.name AS exit_reason_name,
            TIMESTAMPDIFF(MONTH, e.join_date, COALESCE(e.exit_date, CURDATE())) AS service_months,
            CASE WHEN ${PROFILE_INCOMPLETE_SQL} THEN 0 ELSE 1 END AS is_profile_complete
     FROM employees e
     LEFT JOIN companies c ON c.id = e.company_id
     INNER JOIN brands b ON b.id = e.brand_id
     INNER JOIN positions p ON p.id = e.position_id
     INNER JOIN divisions d ON d.id = p.division_id
     INNER JOIN locations l ON l.id = e.location_id
     LEFT JOIN exit_reasons er ON er.id = e.exit_reason_id
     WHERE e.id = ? AND ${scope.clause}
     LIMIT 1`,
    [employeeId, ...scope.params],
  );
  return rows[0] ?? null;
}

export async function listEmployees(
  user: SessionUser,
  search = "",
  incompleteOnly = false,
  page = 1,
  pageSize = 25,
  filters: EmployeeListFilters = {},
): Promise<EmployeeListResult> {
  const scope = directBrandScope(user, "e.brand_id");
  const clauses = [scope.clause];
  const params: SqlValue[] = [...scope.params];
  if (incompleteOnly) {
    clauses.push(`e.is_active = TRUE AND ${PROFILE_INCOMPLETE_SQL}`);
  }
  if (filters.brandId) {
    clauses.push("e.brand_id = ?");
    params.push(filters.brandId);
  }
  if (filters.companyId) {
    clauses.push("e.company_id = ?");
    params.push(filters.companyId);
  }
  if (filters.divisionId) {
    clauses.push("p.division_id = ?");
    params.push(filters.divisionId);
  }
  if (filters.locationId) {
    clauses.push("e.location_id = ?");
    params.push(filters.locationId);
  }
  if (filters.status === "active") {
    clauses.push("e.is_active = TRUE");
  } else if (filters.status === "inactive") {
    clauses.push("e.is_active = FALSE");
  }
  const searchFilter = employeeSearch(search);
  clauses.push(searchFilter.clause);
  params.push(...searchFilter.params);

  const where = `WHERE ${clauses.join(" AND ")}`;
  const offset = (page - 1) * pageSize;

  const listQuery = queryRows<EmployeeListItem>(
    `SELECT e.id, e.employee_code, e.full_name, e.company_id, c.name AS company_name,
            b.name AS brand_name, p.name AS position_name, d.name AS division_name,
            l.name AS location_name, DATE_FORMAT(e.join_date, '%Y-%m-%d') AS join_date, e.is_active, e.exit_date,
            TIMESTAMPDIFF(MONTH, e.join_date, COALESCE(e.exit_date, CURDATE())) AS service_months,
            CASE WHEN ${PROFILE_INCOMPLETE_SQL} THEN 0 ELSE 1 END AS is_profile_complete
     FROM employees e
     LEFT JOIN companies c ON c.id = e.company_id
     INNER JOIN brands b ON b.id = e.brand_id
     INNER JOIN positions p ON p.id = e.position_id
     INNER JOIN divisions d ON d.id = p.division_id
     INNER JOIN locations l ON l.id = e.location_id
     ${where}
     ORDER BY e.is_active DESC, e.full_name
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const countJoins = filters.divisionId
    ? "INNER JOIN positions p ON p.id = e.position_id"
    : "";
  const countQuery = queryRows<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total
     FROM employees e
     ${countJoins}
     ${where}`,
    params,
  );
  const [employees, countRows] = await Promise.all([listQuery, countQuery]);

  return { employees, total: Number(countRows[0]?.total ?? 0) };
}

export async function countIncompleteEmployees(
  user: SessionUser,
): Promise<number> {
  const scope = directBrandScope(user, "e.brand_id");
  const rows = await queryRows<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total
     FROM employees e
     WHERE e.is_active = TRUE AND ${PROFILE_INCOMPLETE_SQL}
       AND ${scope.clause}`,
    scope.params,
  );
  return Number(rows[0]?.total ?? 0);
}

export interface EmployeeEditItem extends RowDataPacket {
  id: number;
  employee_code: string;
  full_name: string;
  birth_place: string | null;
  birth_date: string | null;
  address_current: string | null;
  address_ktp: string | null;
  email: string | null;
  phone: string | null;
  join_date: string | null;
  npwp_encrypted: string | null;
  bank_name: string | null;
  bank_account_encrypted: string | null;
  marital_status: "SINGLE" | "MARRIED" | "DIVORCED" | null;
  children_count: number | null;
  company_id: number | null;
  brand_id: number;
  position_id: number;
  location_id: number;
  nik_encrypted: string | null;
  ktp_photo_path: string | null;
}
export async function getEmployeeForEdit(
  user: SessionUser,
  employeeId: number,
): Promise<
  | (Omit<
      EmployeeEditItem,
      "nik_encrypted" | "npwp_encrypted" | "bank_account_encrypted"
    > & {
      nik: string | null;
      npwp: string | null;
      bankAccountNumber: string | null;
    })
  | null
> {
  if (!user.permissions.includes(PERMISSIONS.employeeViewPrivateFields))
    return null;
  const scope = directBrandScope(user, "e.brand_id");
  const rows = await queryRows<EmployeeEditItem>(
    `SELECT e.id, e.employee_code, e.full_name, e.birth_place, DATE_FORMAT(e.birth_date, '%Y-%m-%d') AS birth_date, e.address_current, e.address_ktp, e.email, e.phone, DATE_FORMAT(e.join_date, '%Y-%m-%d') AS join_date, e.npwp_encrypted, e.bank_name, e.bank_account_encrypted, e.marital_status, e.children_count, e.company_id, e.brand_id, e.position_id, e.location_id, e.nik_encrypted, e.ktp_photo_path FROM employees e WHERE e.id=? AND ${scope.clause} LIMIT 1`,
    [employeeId, ...scope.params],
  );
  const row = rows[0];
  if (!row) return null;
  const { nik_encrypted, npwp_encrypted, bank_account_encrypted, ...rest } =
    row;
  const canViewSensitive = user.permissions.includes("employee.view_sensitive");
  const masked = maskSensitiveFields(user, {
    nik: canViewSensitive && nik_encrypted ? decryptField(nik_encrypted) : null,
    npwp:
      canViewSensitive && npwp_encrypted ? decryptField(npwp_encrypted) : null,
    bankAccountNumber:
      canViewSensitive && bank_account_encrypted
        ? decryptField(bank_account_encrypted)
        : null,
    ktpPhotoPath: rest.ktp_photo_path,
    addressCurrent: rest.address_current,
    birthPlace: rest.birth_place,
    birthDate: rest.birth_date,
    email: rest.email,
    phone: rest.phone,
    motherName: null,
    religion: null,
    maritalStatus: rest.marital_status,
    childrenCount: rest.children_count,
    cvFilePath: null,
  });
  if (canViewSensitive)
    await logAudit({
      userId: user.id,
      action: "security.sensitive_read",
      entityType: "employee",
      entityId: employeeId,
      details: { fields: ["nik", "npwp", "bank_account"] },
    });
  return {
    ...rest,
    nik: masked.nik,
    npwp: masked.npwp,
    bankAccountNumber: masked.bankAccountNumber,
  };
}
