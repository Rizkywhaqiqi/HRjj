import { NextResponse } from "next/server";
import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listEmployeeReport } from "@/modules/reports";
import { logAudit } from "@/core/audit/log";

function csv(value: unknown): string { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
export async function GET() { const actor = await requirePermission(PERMISSIONS.reportExport); const rows = await listEmployeeReport(actor); await logAudit({ userId: actor.id, action: "security.export", entityType: "employee_report", details: { format: "csv", rowCount: rows.length } }); const lines = ["Kode,Nama,Brand,CV,Divisi,Jabatan,Lokasi,Tanggal Masuk,Status,Tanggal Keluar", ...rows.map((row) => [row.employee_code, row.full_name, row.brand_name, row.company_name, row.division_name, row.position_name, row.location_name, row.join_date, row.is_active ? "Aktif" : "Nonaktif", row.exit_date ?? ""].map(csv).join(","))]; return new NextResponse(`\uFEFF${lines.join("\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=employee-report.csv", "Cache-Control": "no-store" } }); }
