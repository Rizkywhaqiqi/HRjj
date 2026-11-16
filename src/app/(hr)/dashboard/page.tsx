import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  UserCheck,
  UserX,
} from "lucide-react";
import { queryRows } from "@/core/db";
import { hasPermission, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { brandScope, directBrandScope } from "@/core/rbac/scope";
import { listAuditLogs } from "@/modules/audit";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  cn,
} from "@/components/ui/primitives";
import type { CountRow } from "@/types/database";
import type { RowDataPacket } from "mysql2/promise";

export const instant = false;

interface BreakdownRow extends RowDataPacket { label: string; total: number; }

const STAT_ICONS = {
  active: UserCheck,
  inactive: UserX,
  vacancy: Briefcase,
} as const;

const ICON_TONES = {
  brand: "bg-brand-50 text-brand-700",
  slate: "bg-slate-100 text-slate-600",
  sky: "bg-sky-50 text-sky-700",
} as const;

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: keyof typeof STAT_ICONS;
  tone: keyof typeof ICON_TONES;
}) {
  const Icon = STAT_ICONS[icon];

  return (
    <Card>
      <CardBody className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <div className={cn("rounded-xl p-2.5", ICON_TONES[tone])}>
          <Icon aria-hidden="true" size={19} />
        </div>
      </CardBody>
    </Card>
  );
}

function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const user = await requirePermission(PERMISSIONS.dashboardView);

  const employeeScope = directBrandScope(user, "e.brand_id");
  const vacancyScope = brandScope(user, "v.company_id");
  const brandIdScope = directBrandScope(user, "b.id");
  const companyBrandScope = directBrandScope(user, "c.brand_id");

  const [
    activeRows,
    inactiveRows,
    vacancyRows,
    brandRows,
    companyRows,
    divisionRows,
    positionRows,
    byBrandRows,
    byCompanyRows,
    byDivisionRows,
    byLocationRows,
    turnoverRows,
  ] = await Promise.all([
    queryRows<CountRow>(
      `SELECT COUNT(*) AS total FROM employees e
       WHERE e.is_active = 1 AND ${employeeScope.clause}`,
      employeeScope.params,
    ),
    queryRows<CountRow>(
      `SELECT COUNT(*) AS total FROM employees e
       WHERE e.is_active = 0 AND ${employeeScope.clause}`,
      employeeScope.params,
    ),
    queryRows<CountRow>(
      `SELECT COUNT(*) AS total FROM vacancies v
       WHERE v.status = 'OPEN' AND ${vacancyScope.clause}`,
      vacancyScope.params,
    ),
    queryRows<CountRow>(
      `SELECT COUNT(*) AS total FROM brands b
       WHERE b.is_active = 1 AND ${brandIdScope.clause}`,
      brandIdScope.params,
    ),
    queryRows<CountRow>(
      `SELECT COUNT(*) AS total FROM companies c
       WHERE c.is_active = 1 AND ${companyBrandScope.clause}`,
      companyBrandScope.params,
    ),
    queryRows<CountRow>(
      "SELECT COUNT(*) AS total FROM divisions WHERE is_active = 1",
    ),
    queryRows<CountRow>(
      "SELECT COUNT(*) AS total FROM positions WHERE is_active = 1",
    ),
    queryRows<BreakdownRow>(`SELECT b.name AS label, COUNT(*) AS total FROM employees e INNER JOIN brands b ON b.id=e.brand_id WHERE e.is_active=TRUE AND ${employeeScope.clause} GROUP BY b.id, b.name ORDER BY total DESC, label`, employeeScope.params),
    queryRows<BreakdownRow>(`SELECT COALESCE(c.name, 'CV belum dipilih') AS label, COUNT(*) AS total FROM employees e LEFT JOIN companies c ON c.id=e.company_id WHERE e.is_active=TRUE AND ${employeeScope.clause} GROUP BY c.id, c.name ORDER BY total DESC, label`, employeeScope.params),
    queryRows<BreakdownRow>(`SELECT d.name AS label, COUNT(*) AS total FROM employees e INNER JOIN positions p ON p.id=e.position_id INNER JOIN divisions d ON d.id=p.division_id WHERE e.is_active=TRUE AND ${employeeScope.clause} GROUP BY d.id, d.name ORDER BY total DESC, label`, employeeScope.params),
    queryRows<BreakdownRow>(`SELECT COALESCE(l.name, 'Tanpa lokasi') AS label, COUNT(*) AS total FROM employees e LEFT JOIN locations l ON l.id=e.location_id WHERE e.is_active=TRUE AND ${employeeScope.clause} GROUP BY l.id, l.name ORDER BY total DESC, label`, employeeScope.params),
    queryRows<CountRow>(`SELECT COUNT(*) AS total FROM employees e WHERE e.is_active=FALSE AND e.exit_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) AND ${employeeScope.clause}`, employeeScope.params),
  ]);

  const canViewAudit = hasPermission(user, PERMISSIONS.auditView);
  const recentAudit = canViewAudit
    ? await listAuditLogs({ page: 1, pageSize: 5 })
    : null;

  const organisation = [
    { label: "Brand", value: brandRows[0]?.total ?? 0 },
    { label: "CV", value: companyRows[0]?.total ?? 0 },
    { label: "Divisi", value: divisionRows[0]?.total ?? 0 },
    { label: "Jabatan", value: positionRows[0]?.total ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title={`Selamat datang, ${user.name.split(" ")[0]}`}
        description="Ringkasan kondisi organisasi dan pekerjaan HR yang perlu perhatian."
        action={
          <Badge tone="brand">
            {user.scopeAll ? "Akses semua brand" : `${user.brandIds.length} brand`}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Karyawan aktif"
          value={activeRows[0]?.total ?? 0}
          hint="Sesuai cakupan brand Anda"
          icon="active"
          tone="brand"
        />
        <StatCard
          label="Karyawan nonaktif"
          value={inactiveRows[0]?.total ?? 0}
          hint="Arsip, tidak pernah dihapus"
          icon="inactive"
          tone="slate"
        />
        <StatCard
          label="Lowongan terbuka"
          value={vacancyRows[0]?.total ?? 0}
          hint="Proses recruitment"
          icon="vacancy"
          tone="sky"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader
            title="Ringkasan organisasi"
            description="Brand, CV, divisi, dan jabatan aktif pada cakupan akses Anda."
            action={
              hasPermission(user, PERMISSIONS.masterDataView) ? (
                <Link
                  href="/master-data"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
                >
                  Kelola
                  <ArrowUpRight aria-hidden="true" size={15} />
                </Link>
              ) : null
            }
          />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {organisation.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-4"
                >
                  <dt className="text-xs font-medium text-slate-500">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-slate-900">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {hasPermission(user, PERMISSIONS.userView) ? (
                <Link
                  href="/settings/users"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/50"
                >
                  Kelola pengguna internal
                </Link>
              ) : null}
              {hasPermission(user, PERMISSIONS.roleView) ? (
                <Link
                  href="/settings/roles"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/50"
                >
                  Matriks peran & izin
                </Link>
              ) : null}
            </div>

            <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
              Modul karyawan, surat, dan recruitment tampil di menu
              setelah fase terkait selesai dan saklar fiturnya aktif.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Aktivitas terbaru"
            description={
              canViewAudit
                ? "Audit log terakhir pada sistem."
                : "Audit log hanya untuk pengguna dengan izin khusus."
            }
            action={
              canViewAudit ? (
                <Link
                  href="/settings/audit-logs"
                  className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                >
                  Lihat semua
                </Link>
              ) : null
            }
          />
          <CardBody>
            {recentAudit && recentAudit.rows.length > 0 ? (
              <ul className="space-y-3">
                {recentAudit.rows.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {entry.action}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {entry.entity_type}
                        {entry.entity_id ? ` #${entry.entity_id}` : ""} ·{" "}
                        {entry.user_name ?? "Sistem"}
                      </p>
                    </div>
                    <time className="whitespace-nowrap text-xs text-slate-400">
                      {formatDateTime(entry.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Belum ada aktivitas tercatat" />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Distribusi karyawan aktif" description="Breakdown dihitung dinamis dan mengikuti scope brand pengguna." />
        <CardBody>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[{ title: "Per Brand", rows: byBrandRows }, { title: "Per CV", rows: byCompanyRows }, { title: "Per Divisi", rows: byDivisionRows }, { title: "Per Lokasi", rows: byLocationRows }].map((group) => <div key={group.title}><h3 className="text-sm font-semibold text-slate-800">{group.title}</h3><ul className="mt-3 space-y-2">{group.rows.map((row) => <li key={row.label} className="flex justify-between gap-3 text-sm"><span className="truncate text-slate-600">{row.label}</span><b className="text-slate-900">{row.total}</b></li>)}{group.rows.length === 0 ? <li className="text-xs text-slate-500">Belum ada data.</li> : null}</ul></div>)}
          </div>
          <div className="mt-6 rounded-xl bg-amber-50 px-4 py-3"><p className="text-xs font-medium uppercase tracking-wide text-amber-700">Turnover 12 bulan terakhir</p><p className="mt-1 text-2xl font-semibold text-amber-900">{turnoverRows[0]?.total ?? 0}</p><p className="text-xs text-amber-800">Karyawan nonaktif dengan tanggal keluar dalam 12 bulan terakhir.</p></div>
        </CardBody>
      </Card>
    </div>
  );
}
