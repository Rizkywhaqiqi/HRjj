"use server";
import { executeSql } from "@/core/db";
import { logAudit } from "@/core/audit/log";
import { redirectWithMessage } from "@/core/http/navigation";
import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";

export async function toggleChecklistAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.checklistUpdate);
  const id = Number(formData.get("id"));
  const completed = formData.get("completed") === "true";
  if (!Number.isInteger(id) || id <= 0) redirectWithMessage("/checklists", "error", "Checklist tidak valid.");
  const result = await executeSql(`UPDATE checklist_items ci INNER JOIN employees e ON e.id = ci.employee_id
    SET ci.is_completed = ?, ci.completed_by = IF(?, ?, NULL), ci.completed_at = IF(?, NOW(), NULL)
    WHERE ci.id = ? AND (? OR e.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id = ?))`, [completed, completed, actor.id, completed, id, actor.scopeAll, actor.id]);
  if (result.affectedRows !== 1) redirectWithMessage("/checklists", "error", "Checklist tidak ditemukan atau di luar scope.");
  await logAudit({ userId: actor.id, action: "checklist.update", entityType: "checklist_item", entityId: id, details: { completed } });
  redirectWithMessage("/checklists", "ok", "Checklist diperbarui.");
}
