import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { brandScope, directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";
export interface LetterListItem extends RowDataPacket { id: number; letter_number: string; type: string; full_name: string; company_name: string; issued_date: string | Date; status: string; file_path: string; }
export function listLetters(
  user: SessionUser,
  employeeId?: number | null,
): Promise<LetterListItem[]> {
  const scope = brandScope(user, "l.company_id");
  return queryRows<LetterListItem>(
    `SELECT l.id, l.letter_number, l.type, e.full_name, c.name AS company_name,
            l.issued_date, l.status, l.file_path
     FROM letters l
     INNER JOIN employees e ON e.id = l.employee_id
     INNER JOIN companies c ON c.id = l.company_id
     WHERE ${scope.clause}${employeeId ? " AND l.employee_id = ?" : ""}
     ORDER BY l.id DESC`,
    employeeId ? [...scope.params, employeeId] : scope.params,
  );
}
export interface LetterEmployeeContext extends RowDataPacket {
  id: number;
  employee_code: string;
  full_name: string;
  company_name: string | null;
  position_name: string;
}
export async function getLetterEmployeeContext(user: SessionUser, employeeId: number): Promise<LetterEmployeeContext | null> {
  const scope = directBrandScope(user, "e.brand_id");
  const rows = await queryRows<LetterEmployeeContext>(
    `SELECT e.id, e.employee_code, e.full_name, c.name AS company_name, p.name AS position_name
     FROM employees e
     LEFT JOIN companies c ON c.id = e.company_id
     INNER JOIN positions p ON p.id = e.position_id
     WHERE e.id = ? AND e.is_active = TRUE AND ${scope.clause}
     LIMIT 1`,
    [employeeId, ...scope.params],
  );
  return rows[0] ?? null;
}
export interface LetterContractContext extends RowDataPacket {
  id: number;
  employee_id: number;
  contract_type_name: string;
  contract_start_date: string;
  contract_end_date: string | null;
  base_salary: string | null;
  status: string;
  is_permanent: 0 | 1;
  letter_id: number | null;
}
export async function getLetterContractContext(
  user: SessionUser,
  employeeId: number,
  contractId: number,
): Promise<LetterContractContext | null> {
  const scope = brandScope(user, "c.id");
  const rows = await queryRows<LetterContractContext>(
    `SELECT ct.id, ct.employee_id, ty.name AS contract_type_name,
            DATE_FORMAT(ct.start_date, '%Y-%m-%d') AS contract_start_date,
            DATE_FORMAT(ct.end_date, '%Y-%m-%d') AS contract_end_date,
            ct.base_salary, ct.status, ty.is_permanent, ct.letter_id
     FROM contracts ct
     INNER JOIN contract_types ty ON ty.id = ct.contract_type_id
     INNER JOIN employees e ON e.id = ct.employee_id
     INNER JOIN companies c ON c.id = e.company_id
     WHERE ct.id = ? AND e.id = ? AND ${scope.clause}
     LIMIT 1`,
    [contractId, employeeId, ...scope.params],
  );
  return rows[0] ?? null;
}
export interface LetterPreviewInfo extends RowDataPacket { id: number; letter_number: string; type: string; full_name: string; status: string; }
export async function getLetterPreviewInfo(user: SessionUser, letterId: number): Promise<LetterPreviewInfo | null> {
  const scope = brandScope(user, "l.company_id");
  const rows = await queryRows<LetterPreviewInfo>(
    `SELECT l.id, l.letter_number, l.type, e.full_name, l.status
     FROM letters l
     INNER JOIN employees e ON e.id = l.employee_id
     WHERE l.id = ? AND ${scope.clause}
     LIMIT 1`,
    [letterId, ...scope.params],
  );
  return rows[0] ?? null;
}
export interface LetterTemplateListItem extends RowDataPacket { id: number; type: string; company_id: number | null; company_name: string | null; name: string; version: number; is_active: 0 | 1; created_at: string; }
export function listLetterTemplates(user: SessionUser): Promise<LetterTemplateListItem[]> {
  const scope = user.scopeAll ? { clause: "1=1", params: [] as (string | number | null)[] } : user.brandIds.length === 0 ? { clause: "t.company_id IS NULL", params: [] as (string | number | null)[] } : { clause: `(t.company_id IS NULL OR c.brand_id IN (${user.brandIds.map(() => "?").join(", ")}))`, params: user.brandIds as (string | number | null)[] };
  return queryRows<LetterTemplateListItem>(`SELECT t.id, t.type, t.company_id, c.name AS company_name, t.name, t.version, t.is_active, t.created_at FROM letter_templates t LEFT JOIN companies c ON c.id=t.company_id WHERE ${scope.clause} ORDER BY t.type, t.company_id IS NULL, t.version DESC`, scope.params);
}
