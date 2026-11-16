import { hasPermission, requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listChecklistItems, toggleChecklistAction } from "@/modules/checklists";
import { Card, CardBody, PageHeader, Badge } from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";

export const instant = false;
export default async function ChecklistsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission(PERMISSIONS.checklistView); await requireFeatureEnabled("checklists");
  const [items, params] = await Promise.all([listChecklistItems(actor), searchParams]);
  const canUpdate = hasPermission(actor, PERMISSIONS.checklistUpdate);
  return <div><PageHeader title="Checklist operasional" description="Pantau onboarding dan offboarding karyawan." /><FlashAlerts {...readFlash(params)} /><Card><CardBody><ul className="space-y-3">{items.map((item) => <li key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Badge tone={item.category === "ONBOARDING" ? "info" : "warning"}>{item.category}</Badge><span className="text-xs text-slate-500">{item.employee_code}</span></div><p className="mt-1 text-sm font-semibold">{item.employee_name}</p><p className="text-sm text-slate-600">{item.title}</p></div>{canUpdate ? <form action={toggleChecklistAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="completed" value={item.is_completed ? "false" : "true"} /><button className={`rounded-lg px-3 py-2 text-xs font-semibold ${item.is_completed ? "border border-slate-300 text-slate-600" : "bg-brand-600 text-white"}`}>{item.is_completed ? "Tandai belum selesai" : "Tandai selesai"}</button></form> : <Badge tone={item.is_completed ? "success" : "neutral"}>{item.is_completed ? "Selesai" : "Belum selesai"}</Badge>}</li>)}{items.length === 0 ? <li className="text-sm text-slate-500">Belum ada checklist.</li> : null}</ul></CardBody></Card></div>;
}
