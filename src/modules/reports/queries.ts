import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";

export interface EmployeeReportRow extends RowDataPacket { employee_code: string; full_name: string; brand_name: string; company_name: string | null; division_name: string; position_name: string; location_name: string; join_date: string | null; is_active: 0 | 1; exit_date: string | null; }
export function listEmployeeReport(user: SessionUser): Promise<EmployeeReportRow[]> { const scope = directBrandScope(user, "e.brand_id"); return queryRows<EmployeeReportRow>(`SELECT e.employee_code, e.full_name, b.name AS brand_name, c.name AS company_name, d.name AS division_name, p.name AS position_name, l.name AS location_name, e.join_date, e.is_active, e.exit_date FROM employees e LEFT JOIN companies c ON c.id=e.company_id INNER JOIN brands b ON b.id=e.brand_id INNER JOIN positions p ON p.id=e.position_id INNER JOIN divisions d ON d.id=p.division_id INNER JOIN locations l ON l.id=e.location_id WHERE ${scope.clause} ORDER BY b.name, e.full_name`, scope.params); }
