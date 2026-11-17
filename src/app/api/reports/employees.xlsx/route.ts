import ExcelJS from "exceljs";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listEmployeeReport } from "@/modules/reports";
import {
  reportAccess,
  reportColumns,
  projectReportRow,
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
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Karyawan");
  const columns = reportColumns(access);
  sheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width,
  }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF176B58" },
  };
  for (const row of rows) sheet.addRow(projectReportRow(row, access));
  sheet.eachRow((row, n) => {
    if (n > 1) row.alignment = { vertical: "top", wrapText: true };
  });
  await logAudit({
    userId: actor.id,
    action: "security.export",
    entityType: "employee_report",
    details: { format: "xlsx", rowCount: rows.length, ...access },
  });
  return new Response(new Uint8Array(await workbook.xlsx.writeBuffer()), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=employee-report.xlsx",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
