import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listAuditEntityTypes, listAuditLogs } from "@/modules/audit";
import { Card, CardBody, PageHeader, inputClass, buttonSecondary } from "@/components/ui/primitives";
import { Pagination, parsePage } from "@/components/shared/pagination";
import { firstParam, formatDateTime } from "@/components/shared/format";

export const instant = false;
const PAGE_SIZE = 20;

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission(PERMISSIONS.auditView);
  const params = await searchParams;
  const page = parsePage(params.page);
  const action = firstParam(params.action) ?? "";
  const entityType = firstParam(params.entityType) ?? "";
  const [result, entityTypes] = await Promise.all([
    listAuditLogs({ action, entityType, page, pageSize: PAGE_SIZE }),
    listAuditEntityTypes(),
  ]);

  return (
    <div>
      <PageHeader title="Riwayat aktivitas" description="Login, pengelolaan akun dan hak akses, pembuatan surat, perubahan data, impor, ekspor, dan akses data sensitif. Filter, pencarian, dan navigasi tidak dicatat." />
      <Card>
        <CardBody>
          <form method="get" className="mb-5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input name="action" defaultValue={action} placeholder="Cari action" className={inputClass} />
            <select name="entityType" defaultValue={entityType} className={inputClass}><option value="">Semua entitas</option>{entityTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <button type="submit" className={buttonSecondary}>Filter</button>
          </form>
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Waktu</th><th className="px-3 py-2">Pengguna</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entitas</th><th className="px-3 py-2">Detail</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.id} className="border-b border-slate-100 align-top"><td className="px-3 py-3 whitespace-nowrap">{formatDateTime(row.created_at)}</td><td className="px-3 py-3">{row.user_name ?? "Sistem"}</td><td className="px-3 py-3 font-medium">{row.action}</td><td className="px-3 py-3">{row.entity_type}{row.entity_id ? ` #${row.entity_id}` : ""}</td><td className="max-w-sm px-3 py-3 text-xs text-slate-500">{typeof row.details === "string" ? row.details : row.details ? JSON.stringify(row.details) : "-"}</td></tr>)}</tbody></table></div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} basePath="/settings/audit-logs" query={{ action: action || undefined, entityType: entityType || undefined }} />
        </CardBody>
      </Card>
    </div>
  );
}
