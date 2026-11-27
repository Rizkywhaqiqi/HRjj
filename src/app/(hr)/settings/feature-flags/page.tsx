import { SubmitButton } from "@/components/ui/form";
import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  listFeatureFlags,
  setFeatureFlagAction,
} from "@/modules/feature-flags";
import { Card, CardBody, PageHeader, Badge } from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";

export const instant = false;

export default async function FeatureFlagsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.featureFlagManage);
  const [flags, params] = await Promise.all([listFeatureFlags(), searchParams]);

  return (
    <div>
      <PageHeader
        title="Modul aplikasi"
        description="Aktifkan atau nonaktifkan modul tanpa mengubah kode aplikasi."
      />
      <FlashAlerts {...readFlash(params)} />
      <Card>
        <CardBody>
          <ul className="space-y-3">
            {flags.map((flag) => (
              <li
                key={flag.feature_key}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{flag.label}</p>
                  <p className="text-xs text-slate-500">{flag.feature_key}</p>
                </div>
                <form
                  action={setFeatureFlagAction}
                  className="flex items-center gap-3"
                >
                  <input
                    type="hidden"
                    name="featureKey"
                    value={flag.feature_key}
                  />
                  <Badge tone={flag.is_enabled ? "success" : "neutral"}>
                    {flag.is_enabled ? "Aktif" : "Nonaktif"}
                  </Badge>
                  <input
                    type="hidden"
                    name="enabled"
                    value={flag.is_enabled ? "false" : "true"}
                  />
                  <SubmitButton
                    unstyled
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {flag.is_enabled ? "Nonaktifkan" : "Aktifkan"}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
