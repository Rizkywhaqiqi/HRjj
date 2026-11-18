import Link from "next/link";
import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import {
  hasPermission,
  isFeatureEnabled,
  requirePermission,
} from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { directBrandScope } from "@/core/rbac/scope";
import { contractReminder } from "@/modules/contracts/reminders";
import {
  Card,
  CardHeader,
  CardBody,
  PageHeader,
  Badge,
  EmptyState,
  buttonPrimary,
  buttonSecondary,
} from "@/components/ui/primitives";
import { formatDate } from "@/components/shared/format";
export const instant = false;
interface Summary extends RowDataPacket {
  total: number;
  active: number;
  inactive: number;
}
interface Breakdown extends RowDataPacket {
  category: string;
  label: string;
  total: number;
}
interface Reminder extends RowDataPacket {
  id: number;
  employee_id: number;
  full_name: string;
  end_date: string;
  days_remaining: number;
}
export default async function Dashboard() {
  const actor = await requirePermission(PERMISSIONS.dashboardView);
  const s = directBrandScope(actor, "e.brand_id");
  const canContracts =
    hasPermission(actor, PERMISSIONS.contractView) &&
    (await isFeatureEnabled("contracts"));
  const canRenew =
    hasPermission(actor, PERMISSIONS.contractCreate) &&
    hasPermission(actor, PERMISSIONS.contractDecide) &&
    hasPermission(actor, PERMISSIONS.letterCreate) &&
    hasPermission(actor, PERMISSIONS.letterView) &&
    (await isFeatureEnabled("letters"));
  const [summaries, breakdown, reminders] = await Promise.all([
    queryRows<Summary>(
      `SELECT COUNT(*) total,COALESCE(SUM(e.is_active=1),0) active,COALESCE(SUM(e.is_active=0),0) inactive FROM employees e WHERE ${s.clause}`,
      s.params,
    ),
    queryRows<Breakdown>(
      `SELECT 'Brand' category,b.name label,COUNT(*) total FROM employees e JOIN brands b ON b.id=e.brand_id WHERE ${s.clause} GROUP BY b.id,b.name UNION ALL SELECT 'Divisi' category,d.name label,COUNT(*) total FROM employees e JOIN positions p ON p.id=e.position_id JOIN divisions d ON d.id=p.division_id WHERE ${s.clause} GROUP BY d.id,d.name UNION ALL SELECT 'Lokasi' category,l.name label,COUNT(*) total FROM employees e JOIN locations l ON l.id=e.location_id WHERE ${s.clause} GROUP BY l.id,l.name`,
      [...s.params, ...s.params, ...s.params],
    ),
    canContracts
      ? queryRows<Reminder>(
          `SELECT ct.id,ct.employee_id,e.full_name,ct.end_date,DATEDIFF(ct.end_date,DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+07:00'))) days_remaining FROM contracts ct JOIN employees e ON e.id=ct.employee_id WHERE ct.status='RUNNING' AND e.is_active=TRUE AND ct.end_date IS NOT NULL AND ct.end_date<=DATE_ADD(DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+07:00')),INTERVAL 30 DAY) AND ${s.clause} ORDER BY ct.end_date LIMIT 100`,
          s.params,
        )
      : Promise.resolve([]),
  ]);
  const summary = summaries[0];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard HR"
        description="Ringkasan karyawan dan kontrak yang perlu ditindaklanjuti."
        action={
          hasPermission(actor, PERMISSIONS.employeeCreate) ? (
            <Link href="/employees/new" className={buttonPrimary}>
              Tambah karyawan
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Seluruh karyawan", summary.total],
          ["Karyawan aktif", summary.active],
          ["Karyawan nonaktif", summary.inactive],
        ].map(([label, count]) => (
          <Card key={label}>
            <CardBody>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {count}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
      {canContracts ? (
        <Card>
          <CardHeader
            title="Pengingat kontrak"
            description="H-30, H-7, dan kontrak lewat masa. Dihitung otomatis setiap halaman dibuka, tanpa jadwal email."
            action={
              <Link href="/contracts" className={buttonSecondary}>
                Kelola kontrak
              </Link>
            }
          />
          <CardBody>
            {reminders.length ? (
              <div className="divide-y divide-slate-100">
                {reminders.map((r) => {
                  const status = contractReminder(Number(r.days_remaining));
                  return (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <Link
                          href={`/employees/${r.employee_id}`}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          {r.full_name}
                        </Link>
                        <p className="text-sm text-slate-500">
                          Berakhir {formatDate(r.end_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <Link
                          href={
                            canRenew
                              ? `/letters?employeeId=${r.employee_id}&contractId=${r.id}&type=CONTRACT&flow=renewal`
                              : `/contracts?employeeId=${r.employee_id}`
                          }
                          className={buttonSecondary}
                        >
                          {canRenew
                            ? "Buat surat perpanjangan"
                            : "Tindak lanjuti"}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Tidak ada kontrak yang perlu ditindaklanjuti"
                description="Kontrak yang akan berakhir dalam 30 hari akan muncul di sini."
              />
            )}
          </CardBody>
        </Card>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-3">
        {["Brand", "Divisi", "Lokasi"].map((category) => (
          <Card key={category}>
            <CardHeader title={`Karyawan per ${category.toLowerCase()}`} />
            <CardBody>
              {breakdown
                .filter((b) => b.category === category)
                .map((b) => (
                  <div
                    key={b.label}
                    className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"
                  >
                    <span>{b.label}</span>
                    <b>{b.total}</b>
                  </div>
                ))}
              {!breakdown.some((b) => b.category === category) ? (
                <p className="text-sm text-slate-500">Belum ada data.</p>
              ) : null}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
