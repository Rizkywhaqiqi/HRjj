import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";

export interface ChecklistItem extends RowDataPacket { id: number; employee_id: number; employee_name: string; employee_code: string; category: "ONBOARDING" | "OFFBOARDING"; title: string; is_completed: 0 | 1; completed_at: string | null; }

export function listChecklistItems(user: SessionUser): Promise<ChecklistItem[]> {
  const scope = directBrandScope(user, "e.brand_id");
  return queryRows<ChecklistItem>(`SELECT ci.id, ci.employee_id, e.full_name AS employee_name, e.employee_code,
    ci.category, ci.title, ci.is_completed, ci.completed_at
    FROM checklist_items ci INNER JOIN employees e ON e.id = ci.employee_id
    WHERE ${scope.clause} ORDER BY ci.is_completed, ci.created_at DESC`, scope.params);
}
