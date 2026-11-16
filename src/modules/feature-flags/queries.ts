import { queryRows } from "@/core/db";
import type { FeatureFlagRow } from "@/types/database";

export async function listFeatureFlags(): Promise<FeatureFlagRow[]> {
  return queryRows<FeatureFlagRow>(
    "SELECT feature_key, label, is_enabled, updated_at FROM feature_flags ORDER BY label",
  );
}
