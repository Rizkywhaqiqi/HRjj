import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";
export interface PayrollItem extends RowDataPacket { id: number; employee_id: number; employee_name: string; employee_code: string; period_month: string; base_salary: string; bpjs_health: string; bpjs_employment: string; other_deductions: string; net_amount: string; status: string; }
export function listPayroll(user: SessionUser): Promise<PayrollItem[]> { const scope = directBrandScope(user, "e.brand_id"); return queryRows<PayrollItem>(`SELECT p.id, p.employee_id, e.full_name AS employee_name, e.employee_code, p.period_month, p.base_salary, p.bpjs_health, p.bpjs_employment, p.other_deductions, p.net_amount, p.status FROM payroll_records p INNER JOIN employees e ON e.id=p.employee_id WHERE ${scope.clause} ORDER BY p.period_month DESC, e.full_name`, scope.params); }
