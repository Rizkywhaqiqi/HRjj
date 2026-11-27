"use server";

import { executeSql } from "@/core/db";
import { AUDIT_ACTIONS, logAudit } from "@/core/audit/log";
import { redirectWithMessage } from "@/core/http/navigation";
import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";

export async function setFeatureFlagAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.featureFlagManage);
  if (!actor.scopeAll)
    redirectWithMessage(
      "/settings/feature-flags",
      "error",
      "Pengaturan fitur bersama memerlukan akses semua brand.",
    );
  const featureKey = String(formData.get("featureKey") ?? "");
  const enabled = formData.get("enabled") === "true";

  if (!/^[a-z][a-z0-9_-]{1,59}$/.test(featureKey)) {
    redirectWithMessage(
      "/settings/feature-flags",
      "error",
      "Saklar fitur tidak valid.",
    );
  }

  await executeSql(
    "UPDATE feature_flags SET is_enabled = ? WHERE feature_key = ?",
    [enabled, featureKey],
  );
  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.featureFlagUpdate,
    entityType: "feature_flag",
    entityId: featureKey,
    details: { enabled },
  });
  redirectWithMessage(
    "/settings/feature-flags",
    "ok",
    "Saklar fitur diperbarui.",
  );
}
