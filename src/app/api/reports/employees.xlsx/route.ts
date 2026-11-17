import ExcelJS from "exceljs";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { iterateEmployeeReport } from "@/modules/reports/queries";
import { PassThrough, Readable } from "node:stream";
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
  const rows = iterateEmployeeReport(actor, reportFilters(new URL(request.url).searchParams), access);
  const output = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output, useStyles: true, useSharedStrings: false });
  const sheet = workbook.addWorksheet("Karyawan", { views: [{ state: "frozen", ySplit: 1 }] });
  const columns = reportColumns(access);
  sheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width,
  }));

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
  const produce = async () => {
    let rowCount = 0;
    for await (const row of rows) {
      const added = sheet.addRow(projectReportRow(row, access));
      added.alignment = { vertical: "top", wrapText: true };
      added.commit();
      rowCount++;
    }
    sheet.commit();
    await workbook.commit();
    await logAudit({ userId: actor.id, action: "security.export", entityType: "employee_report", details: { format: "xlsx", rowCount, ...access } });
  };
  void produce().catch((error: Error) => output.destroy(error));
  return new Response(Readable.toWeb(output) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=employee-report.xlsx",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
