import { NextResponse } from "next/server";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { iterateEmployeeReport } from "@/modules/reports/queries";
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
  const rows = iterateEmployeeReport(actor, reportFilters(new URL(request.url).searchParams), access);
  const columns = reportColumns(access);
  const encoder = new TextEncoder();
  let started = false;
  let rowCount = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!started) {
          started = true;
          controller.enqueue(encoder.encode("\uFEFF" + columns.map((c) => safeCsvCell(c.label)).join(",") + "\r\n"));
          return;
        }
        const next = await rows.next();
        if (next.done) {
          await logAudit({ userId: actor.id, action: "security.export", entityType: "employee_report", details: { format: "csv", rowCount, ...access } });
          controller.close();
          return;
        }
        const projected = projectReportRow(next.value, access);
        controller.enqueue(encoder.encode(columns.map((c) => safeCsvCell(projected[c.key])).join(",") + "\r\n"));
        rowCount++;
      } catch (error) { controller.error(error); }
    },
    async cancel() { await rows.return(); },
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=employee-report.csv",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
