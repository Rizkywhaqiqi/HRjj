import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { brandScope, directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";

export interface ContractListItem extends RowDataPacket {
  id: number;
  employee_id: number;
  full_name: string;
  employee_code: string;
  company_name: string;
  brand_name: string;
  contract_type_id: number;
  contract_type_name: string;
  start_date: string | Date;
  end_date: string | Date | null;
  base_salary: string | null;
  status: string;
  letter_id: number | null;
  days_remaining: number | null;
}

export interface ContractEmployeeContext extends RowDataPacket {
  id: number;
  employee_code: string;
  full_name: string;
  company_name: string | null;
}

export async function getContractEmployeeContext(
  user: SessionUser,
  employeeId: number,
): Promise<ContractEmployeeContext | null> {
  const scope = directBrandScope(user, "e.brand_id");
  const rows = await queryRows<ContractEmployeeContext>(
    `SELECT e.id, e.employee_code, e.full_name, c.name AS company_name
     FROM employees e
     LEFT JOIN companies c ON c.id = e.company_id
     WHERE e.id = ? AND e.is_active = TRUE AND ${scope.clause}
     LIMIT 1`,
    [employeeId, ...scope.params],
  );
  return rows[0] ?? null;
}

export async function listContracts(
  user: SessionUser,
  page = 1,
  pageSize = 25,
): Promise<ContractListItem[]> {
  const scope = brandScope(user, "co.id");
  return queryRows<ContractListItem>(
    `SELECT ct.id, ct.employee_id, ct.letter_id, e.full_name, e.employee_code, co.name AS company_name,
            b.name AS brand_name, ct.contract_type_id, ty.name AS contract_type_name,
            ct.start_date, ct.end_date, ct.base_salary, ct.status, DATEDIFF(ct.end_date,DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+07:00'))) AS days_remaining
     FROM contracts ct INNER JOIN employees e ON e.id = ct.employee_id
     INNER JOIN companies co ON co.id = e.company_id INNER JOIN brands b ON b.id = co.brand_id
     INNER JOIN contract_types ty ON ty.id = ct.contract_type_id
     WHERE ${scope.clause} ORDER BY ct.status = 'RUNNING' DESC, ct.end_date IS NULL, ct.end_date, ct.id LIMIT ? OFFSET ?`,
    [...scope.params, pageSize, (page - 1) * pageSize],
  );
}

export async function countContracts(user: SessionUser): Promise<number> {
  const scope = brandScope(user, "co.id");
  const rows = await queryRows<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) total FROM contracts ct JOIN employees e ON e.id=ct.employee_id JOIN companies co ON co.id=e.company_id JOIN contract_types ty ON ty.id=ct.contract_type_id WHERE ${scope.clause}`, scope.params);
  return Number(rows[0]?.total ?? 0);
}
