import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";
import { PROFILE_INCOMPLETE_SQL } from "@/modules/employees/queries";
import type { EmployeeListFilters } from "@/modules/employees/queries";
import { reportAccess } from "./access";
import { decryptField } from "@/core/crypto/field-encrypt";

export interface EmployeeReportRow extends RowDataPacket {
  employee_code: string;
  full_name: string;
  brand_name: string;
  company_name: string | null;
  division_name: string;
  position_name: string;
  location_name: string;
  join_date: string | null;
  is_active: 0 | 1;
  exit_date: string | null;
  birth_place: string | null;
  birth_date: string | null;
  address_current: string | null;
  address_ktp: string | null;
  email: string | null;
  phone: string | null;
  marital_status: string | null;
  children_count: number | null;
  bank_name: string | null;
  nik: string | null;
  npwp: string | null;
  bank_account_number: string | null;
  blood_type: string | null;
  mother_name: string | null;
  religion: string | null;
  exit_reason_name: string | null;
  service_months: number | null;
  ktp_uploaded: 0 | 1 | null;
}

export interface EmployeeReportOptions {
  includePrivate?: boolean;
  includeSensitive?: boolean;
  page?: number;
  pageSize?: number;
}

function decryptOrNull(value: string | null): string | null {
  return value ? decryptField(value) : null;
}

export async function listEmployeeReport(
  user: SessionUser,
  filters: EmployeeListFilters = {},
  options: EmployeeReportOptions = {},
): Promise<EmployeeReportRow[]> {
  const allowed = reportAccess(user);
  const includePrivate =
    allowed.includePrivate && options.includePrivate !== false;
  const includeSensitive =
    allowed.includeSensitive && options.includeSensitive !== false;
  const { clauses, params } = reportWhere(user, filters);
  const pageSize = Math.min(
    100,
    Math.max(1, Math.floor(options.pageSize ?? 25)),
  );
  const paginated = options.page !== undefined;
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const rows = await queryRows<
    EmployeeReportRow & {
      nik_encrypted: string | null;
      npwp_encrypted: string | null;
      bank_account_encrypted: string | null;
    }
  >(
    `SELECT e.employee_code, e.full_name, b.name AS brand_name, c.name AS company_name,
            d.name AS division_name, p.name AS position_name, l.name AS location_name,
            DATE_FORMAT(e.join_date, '%Y-%m-%d') join_date, e.is_active, DATE_FORMAT(e.exit_date, '%Y-%m-%d') exit_date,TIMESTAMPDIFF(MONTH,e.join_date,COALESCE(e.exit_date,CURDATE())) service_months,
            ${includePrivate ? "e.blood_type,e.mother_name,e.religion,er.name exit_reason_name,e.birth_place, DATE_FORMAT(e.birth_date, '%Y-%m-%d') AS birth_date, e.address_current, e.address_ktp, e.email, e.phone, e.marital_status, e.children_count," : "NULL AS blood_type,NULL AS mother_name,NULL AS religion,NULL AS exit_reason_name,NULL AS birth_place, NULL AS birth_date, NULL AS address_current, NULL AS address_ktp, NULL AS email, NULL AS phone, NULL AS marital_status, NULL AS children_count,"}
            ${includeSensitive ? "(e.ktp_photo_path IS NOT NULL AND e.ktp_photo_path <> '') ktp_uploaded,e.bank_name, e.nik_encrypted, e.npwp_encrypted, e.bank_account_encrypted" : "NULL AS ktp_uploaded,NULL AS bank_name, NULL AS nik_encrypted, NULL AS npwp_encrypted, NULL AS bank_account_encrypted"}
     FROM employees e
     LEFT JOIN exit_reasons er ON er.id=e.exit_reason_id
     LEFT JOIN companies c ON c.id=e.company_id
     INNER JOIN brands b ON b.id=e.brand_id
     INNER JOIN positions p ON p.id=e.position_id
     INNER JOIN divisions d ON d.id=p.division_id
     INNER JOIN locations l ON l.id=e.location_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY b.name, e.full_name, e.id${paginated ? " LIMIT ? OFFSET ?" : ""}`,
    paginated ? [...params, pageSize, (page - 1) * pageSize] : params,
  );
  return rows.map(
    ({ nik_encrypted, npwp_encrypted, bank_account_encrypted, ...row }) => ({
      ...row,
      nik: includeSensitive ? decryptOrNull(nik_encrypted) : null,
      npwp: includeSensitive ? decryptOrNull(npwp_encrypted) : null,
      bank_account_number: includeSensitive
        ? decryptOrNull(bank_account_encrypted)
        : null,
    }),
  );
}

function reportWhere(user: SessionUser, filters: EmployeeListFilters) {
  const scope = directBrandScope(user, "e.brand_id");
  const clauses = [scope.clause];
  const params = [...scope.params];
  if (filters.search?.trim()) {
    clauses.push(
      "(e.full_name LIKE ? OR e.employee_code LIKE ? OR e.phone LIKE ?)",
    );
    const term = `%${filters.search.trim()}%`;
    params.push(term, term, term);
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
  }
  if (filters.status === "inactive") {
    clauses.push("e.is_active = FALSE");
  }
  if (filters.incompleteOnly)
    clauses.push(`e.is_active = TRUE AND ${PROFILE_INCOMPLETE_SQL}`);
  return { clauses, params };
}
export async function employeeReportSummary(
  user: SessionUser,
  filters: EmployeeListFilters = {},
) {
  const { clauses, params } = reportWhere(user, filters);
  const rows = await queryRows<
    RowDataPacket & { total: number; active: number; inactive: number }
  >(
    `SELECT COUNT(*) total,COALESCE(SUM(e.is_active=TRUE),0) active,COALESCE(SUM(e.is_active=FALSE),0) inactive FROM employees e JOIN positions p ON p.id=e.position_id WHERE ${clauses.join(" AND ")}`,
    params,
  );
  return rows[0];
}
