import { NextResponse } from "next/server";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listEmployeeReport } from "@/modules/reports";
import {
  reportAccess,
  reportColumns,
  projectReportRow,
  safeCsvCell,
} from "@/modules/reports/access";
import { reportFilters } from "@/modules/reports/filters";
import { logAudit } from "@/core/audit/log";
export async function GET(request: Request) {
  const actor = await requirePermission(PERMISSIONS.reportExport);
  await requireFeatureEnabled("reports");
  const access = reportAccess(actor);
  const rows = await listEmployeeReport(
    actor,
    reportFilters(new URL(request.url).searchParams),
    access,
  );
  const columns = reportColumns(access);
  const lines = [
    columns.map((c) => safeCsvCell(c.label)).join(","),
    ...rows.map((row) => {
      const projected = projectReportRow(row, access);
      return columns.map((c) => safeCsvCell(projected[c.key])).join(",");
    }),
  ];
  await logAudit({
    userId: actor.id,
    action: "security.export",
    entityType: "employee_report",
    details: { format: "csv", rowCount: rows.length, ...access },
  });
  return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=employee-report.csv",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
