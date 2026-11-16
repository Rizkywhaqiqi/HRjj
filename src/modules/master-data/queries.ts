import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import type {
  BrandRow,
  CompanyRow,
  ContractTypeRow,
  DivisionRow,
  ExitReasonRow,
  LocationRow,
  PositionRow,
} from "@/types/database";
import type { SessionUser } from "@/types/database";
import { brandScope } from "@/core/rbac/scope";

export interface SelectOption {
  id: number;
  name: string;
  parentId?: number | null;
}

interface BrandOptionRow extends RowDataPacket {
  id: number;
  name: string;
}

interface CompanyOptionRow extends RowDataPacket {
  id: number; name: string; brand_id: number;
}

interface DivisionOptionRow extends RowDataPacket {
  id: number; name: string;
}

interface PositionOptionRow extends RowDataPacket {
  id: number;
  name: string;
  division_id: number;
}

export async function listBrands(): Promise<BrandRow[]> {
  return queryRows<BrandRow>(
    `SELECT id, code, name, description, is_active, created_at, updated_at
     FROM brands
     ORDER BY name`,
  );
}

export async function listBrandOptions(user?: SessionUser): Promise<SelectOption[]> {
  const scope = user ? brandScope(user, "b.id") : { clause: "1=1", params: [] as (string | number | null)[] };
  const rows = await queryRows<BrandOptionRow>(
    `SELECT id, name FROM brands b WHERE is_active = 1 AND ${scope.clause} ORDER BY name`,
    scope.params,
  );

  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function listCompanies(): Promise<CompanyRow[]> {
  return queryRows<CompanyRow>(
    `SELECT c.id, c.brand_id, c.name, c.address, c.phone, c.email, c.npwp, c.nib,
            c.is_active, b.name AS brand_name, b.code AS brand_code
     FROM companies c
     INNER JOIN brands b ON b.id = c.brand_id
     ORDER BY b.name, c.name`,
  );
}

export async function listCompanyOptions(user?: SessionUser): Promise<SelectOption[]> {
  const scope = user ? brandScope(user, "c.brand_id") : { clause: "1=1", params: [] as (string | number | null)[] };
  const rows = await queryRows<CompanyOptionRow>(
    `SELECT id, name, brand_id FROM companies c WHERE is_active = 1 AND ${scope.clause} ORDER BY name`,
    scope.params,
  );

  return rows.map((row) => ({ id: row.id, name: row.name, parentId: row.brand_id }));
}

export async function listDivisions(): Promise<DivisionRow[]> {
  return queryRows<DivisionRow>(
    `SELECT d.id, d.name, d.is_active,
            (SELECT COUNT(*) FROM positions p WHERE p.division_id = d.id) AS position_count
     FROM divisions d
     ORDER BY d.name`,
  );
}

export async function listDivisionOptions(): Promise<SelectOption[]> {
  const rows = await queryRows<DivisionOptionRow>(
    "SELECT id, name FROM divisions WHERE is_active = 1 ORDER BY name",
  );

  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function listPositions(): Promise<PositionRow[]> {
  return queryRows<PositionRow>(
    `SELECT p.id, p.division_id, p.name, p.is_active, d.name AS division_name,
            (SELECT COUNT(*) FROM employees e WHERE e.position_id = p.id) AS employee_count
     FROM positions p
     INNER JOIN divisions d ON d.id = p.division_id
     ORDER BY d.name, p.name`,
  );
}

export async function listPositionOptions(divisionId?: number): Promise<SelectOption[]> {
  const rows =
    divisionId === undefined
      ? await queryRows<PositionOptionRow>(
          "SELECT id, name, division_id FROM positions WHERE is_active = 1 ORDER BY name",
        )
      : await queryRows<PositionOptionRow>(
          `SELECT id, name, division_id FROM positions
           WHERE is_active = 1 AND division_id = ?
           ORDER BY name`,
          [divisionId],
        );

  return rows.map((row) => ({ id: row.id, name: row.name, parentId: row.division_id }));
}

export async function listLocations(user?: SessionUser, includeInactive = false): Promise<LocationRow[]> {
  const scope = user ? (user.scopeAll ? { clause: "1=1", params: [] as (string | number | null)[] } : user.brandIds.length === 0 ? { clause: "1=0", params: [] as (string | number | null)[] } : { clause: `(l.brand_id IS NULL OR l.brand_id IN (${user.brandIds.map(() => "?").join(", ")}))`, params: user.brandIds as (string | number | null)[] }) : { clause: "1=1", params: [] as (string | number | null)[] };
  return queryRows<LocationRow>(
    `SELECT l.id, l.brand_id, l.name, l.city, l.address, l.is_active,
            b.name AS brand_name
     FROM locations l
     LEFT JOIN brands b ON b.id = l.brand_id
     WHERE ${includeInactive ? "" : "l.is_active = 1 AND "}${scope.clause}
     ORDER BY l.name`,
    scope.params,
  );
}

export async function listExitReasons(): Promise<ExitReasonRow[]> {
  return queryRows<ExitReasonRow>(
    `SELECT id, name, severity, rehirable, is_active
     FROM exit_reasons
     ORDER BY FIELD(severity, 'GREEN', 'YELLOW', 'RED'), name`,
  );
}

export async function listContractTypes(): Promise<ContractTypeRow[]> {
  return queryRows<ContractTypeRow>(
    `SELECT id, name, default_months, reminder_days, is_permanent, is_active
     FROM contract_types
     ORDER BY is_permanent, default_months, name`,
  );
}

interface CountTotalRow extends RowDataPacket {
  total: number;
}

async function scalarCount(
  sql: string,
  params: (string | number)[] = [],
): Promise<number> {
  const rows = await queryRows<CountTotalRow>(sql, params);
  return rows[0]?.total ?? 0;
}

/** Total references that would block deleting a brand. */
export function brandUsageCount(id: number): Promise<number> {
  return scalarCount(
    `SELECT (SELECT COUNT(*) FROM employees WHERE brand_id = ?)
          + (SELECT COUNT(*) FROM companies WHERE brand_id = ?)
          + (SELECT COUNT(*) FROM locations WHERE brand_id = ?) AS total`,
    [id, id, id],
  );
}

export function companyUsageCount(id: number): Promise<number> {
  return scalarCount(
    `SELECT (SELECT COUNT(*) FROM employees WHERE company_id = ?)
          + (SELECT COUNT(*) FROM vacancies WHERE company_id = ?)
          + (SELECT COUNT(*) FROM letters WHERE company_id = ?) AS total`,
    [id, id, id],
  );
}

export function divisionUsageCount(id: number): Promise<number> {
  return scalarCount(
    "SELECT COUNT(*) AS total FROM positions WHERE division_id = ?",
    [id],
  );
}

export function positionUsageCount(id: number): Promise<number> {
  return scalarCount(
    `SELECT (SELECT COUNT(*) FROM employees WHERE position_id = ?)
          + (SELECT COUNT(*) FROM vacancies WHERE position_id = ?) AS total`,
    [id, id],
  );
}

export function locationUsageCount(id: number): Promise<number> {
  return scalarCount(
    `SELECT (SELECT COUNT(*) FROM employees WHERE location_id = ?)
          + (SELECT COUNT(*) FROM vacancies WHERE location_id = ?) AS total`,
    [id, id],
  );
}

export function exitReasonUsageCount(id: number): Promise<number> {
  return scalarCount(
    "SELECT COUNT(*) AS total FROM employees WHERE exit_reason_id = ?",
    [id],
  );
}

export function contractTypeUsageCount(id: number): Promise<number> {
  return scalarCount(
    "SELECT COUNT(*) AS total FROM contracts WHERE contract_type_id = ?",
    [id],
  );
}

export function brandExists(id: number): Promise<boolean> {
  return scalarCount("SELECT COUNT(*) AS total FROM brands WHERE id = ?", [id]).then(
    (total) => total > 0,
  );
}

export function divisionExists(id: number): Promise<boolean> {
  return scalarCount("SELECT COUNT(*) AS total FROM divisions WHERE id = ?", [id]).then(
    (total) => total > 0,
  );
}
