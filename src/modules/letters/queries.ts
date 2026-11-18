import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";
export interface LetterRow extends RowDataPacket {
  id: number;
  letter_number: string;
  type: string;
  employee_id: number;
  full_name: string;
  company_name: string | null;
  issued_date: string;
  status: string;
  file_path: string;
  metadata: unknown;
}
export async function listLetters(
  user: SessionUser,
  employeeId?: number | null,
): Promise<LetterRow[]> {
  const s = directBrandScope(user, "e.brand_id");
  return queryRows<LetterRow>(
    `SELECT l.*,e.full_name,c.name company_name FROM letters l INNER JOIN employees e ON e.id=l.employee_id LEFT JOIN companies c ON c.id=l.company_id WHERE ${s.clause}${employeeId ? " AND l.employee_id=?" : ""} ORDER BY l.id DESC LIMIT 200`,
    employeeId ? [...s.params, employeeId] : s.params,
  );
}
export async function getLetter(
  user: SessionUser,
  id: number,
): Promise<LetterRow | null> {
  const s = directBrandScope(user, "e.brand_id");
  return (
    (
      await queryRows<LetterRow>(
        `SELECT l.*,e.full_name,c.name company_name FROM letters l INNER JOIN employees e ON e.id=l.employee_id LEFT JOIN companies c ON c.id=l.company_id WHERE l.id=? AND ${s.clause} LIMIT 1`,
        [id, ...s.params],
      )
    )[0] ?? null
  );
}
export interface LetterEmployeeOption extends RowDataPacket {
  id: number;
  full_name: string;
  employee_code: string;
}
export async function listLetterEmployees(user: SessionUser) {
  const s = directBrandScope(user, "e.brand_id");
  return queryRows<LetterEmployeeOption>(
    `SELECT e.id,e.full_name,e.employee_code FROM employees e WHERE ${s.clause} ORDER BY e.full_name`,
    s.params,
  );
}

export interface LetterContractDefaults extends RowDataPacket {
  start_date: string;
  end_date: string | null;
  base_salary: string | null;
  contract_type_id: number;
}
export async function getLetterContractDefaults(
  user: SessionUser,
  employeeId: number,
  contractId: number,
  renewal = false,
) {
  const s = directBrandScope(user, "e.brand_id");
  return (
    (
      await queryRows<LetterContractDefaults>(
        `SELECT DATE_FORMAT(ct.start_date,'%Y-%m-%d') start_date,DATE_FORMAT(ct.end_date,'%Y-%m-%d') end_date,ct.base_salary,ct.contract_type_id FROM contracts ct JOIN employees e ON e.id=ct.employee_id WHERE ct.id=? AND ct.employee_id=? AND ct.status='RUNNING' ${renewal ? "AND ct.end_date IS NOT NULL" : "AND ct.letter_id IS NULL"} AND ${s.clause} LIMIT 1`,
        [contractId, employeeId, ...s.params],
      )
    )[0] ?? null
  );
}
