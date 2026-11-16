import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";
export interface WarningItem extends RowDataPacket { id: number; employee_id: number; employee_name: string; employee_code: string; warning_type: string; issue_date: string | Date; expiry_date: string | Date | null; status: string; notes: string | null; }
export function listWarnings(user: SessionUser): Promise<WarningItem[]> { const scope = directBrandScope(user, "e.brand_id"); return queryRows<WarningItem>(`SELECT w.id, w.employee_id, e.full_name AS employee_name, e.employee_code, w.warning_type, w.issue_date, w.expiry_date, IF(w.status='ACTIVE' AND w.expiry_date < CURDATE(), 'EXPIRED', w.status) AS status, w.notes FROM employee_warnings w INNER JOIN employees e ON e.id=w.employee_id WHERE ${scope.clause} ORDER BY w.status, w.issue_date DESC`, scope.params); }
