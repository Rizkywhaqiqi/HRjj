import ExcelJS from "exceljs";
import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listEmployeeReport } from "@/modules/reports";
import { logAudit } from "@/core/audit/log";

export async function GET() {
  const actor = await requirePermission(PERMISSIONS.reportExport);
  const rows = await listEmployeeReport(actor);
  await logAudit({ userId: actor.id, action: "security.export", entityType: "employee_report", details: { format: "xlsx", rowCount: rows.length } });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Karyawan");
  sheet.columns = [
    { header: "Kode", key: "employee_code", width: 18 }, { header: "Nama", key: "full_name", width: 28 },
    { header: "Brand", key: "brand_name", width: 16 }, { header: "CV", key: "company_name", width: 30 },
    { header: "Divisi", key: "division_name", width: 22 }, { header: "Jabatan", key: "position_name", width: 28 },
    { header: "Lokasi", key: "location_name", width: 24 }, { header: "Tanggal Masuk", key: "join_date", width: 16 },
    { header: "Status", key: "status", width: 14 }, { header: "Tanggal Keluar", key: "exit_date", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow({ ...row, status: row.is_active ? "Aktif" : "Nonaktif", exit_date: row.exit_date ?? "" });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=employee-report.xlsx", "Cache-Control": "no-store" } });
}
