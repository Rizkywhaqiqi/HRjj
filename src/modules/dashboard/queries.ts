import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import type { SessionUser } from "@/types/database";
import {
  canViewFinanceDirectory,
  financeWhere,
  type FinanceFilters,
} from "./finance";
export interface FinanceEmployee {
  id: number;
  employee_code: string;
  full_name: string;
  company_name: string | null;
  brand_name: string;
  is_active: 0 | 1;
}
export interface FinanceDirectoryResult {
  rows: FinanceEmployee[];
  total: number;
  page: number;
}
export async function listFinanceEmployees(
  user: SessionUser,
  filters: FinanceFilters,
  requestedPage = 1,
): Promise<FinanceDirectoryResult> {
  if (!canViewFinanceDirectory(user)) return { rows: [], total: 0, page: 1 };
  const { clause, params } = financeWhere(user, filters);
  const counts = await queryRows<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) total FROM employees e WHERE ${clause}`,
    params,
  );
  const total = Number(counts[0]?.total ?? 0);
  const page = Math.min(
    Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1),
    Math.max(1, Math.ceil(total / 25)),
  );
  const rows = total
    ? await queryRows<RowDataPacket & FinanceEmployee>(
        `SELECT e.id,e.employee_code,e.full_name,c.name company_name,b.name brand_name,e.is_active FROM employees e LEFT JOIN companies c ON c.id=e.company_id JOIN brands b ON b.id=e.brand_id WHERE ${clause} ORDER BY b.name,c.name,e.full_name,e.id LIMIT ? OFFSET ?`,
        [...params, 25, (page - 1) * 25],
      )
    : [];
  return { rows, total, page };
}
