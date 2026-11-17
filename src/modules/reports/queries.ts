import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";
import type { EmployeeListFilters } from "@/modules/employees/queries";
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
}

export interface EmployeeReportOptions {
  includePrivate?: boolean;
  includeSensitive?: boolean;
}

function decryptOrNull(value: string | null): string | null {
  return value ? decryptField(value) : null;
}

export async function listEmployeeReport(
  user: SessionUser,
  filters: EmployeeListFilters = {},
  options: EmployeeReportOptions = {},
): Promise<EmployeeReportRow[]> {
  const scope = directBrandScope(user, "e.brand_id");
  const clauses = [scope.clause];
  const params = [...scope.params];
  if (filters.search?.trim()) {
    clauses.push("(e.full_name LIKE ? OR e.employee_code LIKE ? OR e.phone LIKE ?)");
    const term = `%${filters.search.trim()}%`;
    params.push(term, term, term);
  }
  if (filters.brandId) { clauses.push("e.brand_id = ?"); params.push(filters.brandId); }
  if (filters.companyId) { clauses.push("e.company_id = ?"); params.push(filters.companyId); }
  if (filters.divisionId) { clauses.push("p.division_id = ?"); params.push(filters.divisionId); }
  if (filters.locationId) { clauses.push("e.location_id = ?"); params.push(filters.locationId); }
  if (filters.status === "active") { clauses.push("e.is_active = TRUE"); }
  if (filters.status === "inactive") { clauses.push("e.is_active = FALSE"); }
  const rows = await queryRows<EmployeeReportRow & { nik_encrypted: string | null; npwp_encrypted: string | null; bank_account_encrypted: string | null }>(
    `SELECT e.employee_code, e.full_name, b.name AS brand_name, c.name AS company_name,
            d.name AS division_name, p.name AS position_name, l.name AS location_name,
            e.join_date, e.is_active, e.exit_date,
            ${options.includePrivate ? "e.birth_place, DATE_FORMAT(e.birth_date, '%Y-%m-%d') AS birth_date, e.address_current, e.address_ktp, e.email, e.phone, e.marital_status, e.children_count," : "NULL AS birth_place, NULL AS birth_date, NULL AS address_current, NULL AS address_ktp, NULL AS email, NULL AS phone, NULL AS marital_status, NULL AS children_count,"}
            ${options.includeSensitive ? "e.bank_name, e.nik_encrypted, e.npwp_encrypted, e.bank_account_encrypted" : "NULL AS bank_name, NULL AS nik_encrypted, NULL AS npwp_encrypted, NULL AS bank_account_encrypted"}
     FROM employees e
     LEFT JOIN companies c ON c.id=e.company_id
     INNER JOIN brands b ON b.id=e.brand_id
     INNER JOIN positions p ON p.id=e.position_id
     INNER JOIN divisions d ON d.id=p.division_id
     INNER JOIN locations l ON l.id=e.location_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY b.name, e.full_name`,
    params,
  );
  return rows.map(({ nik_encrypted, npwp_encrypted, bank_account_encrypted, ...row }) => ({
    ...row,
    nik: options.includeSensitive ? decryptOrNull(nik_encrypted) : null,
    npwp: options.includeSensitive ? decryptOrNull(npwp_encrypted) : null,
    bank_account_number: options.includeSensitive ? decryptOrNull(bank_account_encrypted) : null,
  }));
}
