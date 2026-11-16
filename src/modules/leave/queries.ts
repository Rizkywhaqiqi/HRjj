import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";
export interface LeaveType extends RowDataPacket { id: number; name: string; annual_days: number; is_active: 0 | 1; }
export interface LeaveRequest extends RowDataPacket { id: number; employee_id: number; employee_name: string; employee_code: string; leave_type_name: string; start_date: string | Date; end_date: string | Date; reason: string | null; status: string; }
export function listLeaveTypes(): Promise<LeaveType[]> { return queryRows<LeaveType>("SELECT id, name, annual_days, is_active FROM leave_types WHERE is_active=TRUE ORDER BY name"); }
export function listLeaveRequests(user: SessionUser): Promise<LeaveRequest[]> { const scope = directBrandScope(user, "e.brand_id"); return queryRows<LeaveRequest>(`SELECT r.id, r.employee_id, e.full_name AS employee_name, e.employee_code, t.name AS leave_type_name, r.start_date, r.end_date, r.reason, r.status FROM leave_requests r INNER JOIN employees e ON e.id=r.employee_id INNER JOIN leave_types t ON t.id=r.leave_type_id WHERE ${scope.clause} ORDER BY r.status='PENDING' DESC, r.start_date DESC`, scope.params); }
