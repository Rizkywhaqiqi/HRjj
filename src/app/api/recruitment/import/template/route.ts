import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/core/auth/session";
import { hasPermission, isFeatureEnabled } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";

export async function GET() {
  const actor = await getSessionUser();
  if (
    !actor ||
    !hasPermission(actor, PERMISSIONS.recruitmentManage) ||
    !(await isFeatureEnabled("recruitment"))
  ) {
    return NextResponse.json({ error: "Tidak memiliki akses." }, { status: 403 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kandidat");
  sheet.columns = [
    { header: "fullName", key: "fullName", width: 28 },
    { header: "email", key: "email", width: 32 },
    { header: "phone", key: "phone", width: 20 },
    { header: "consent", key: "consent", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-import-kandidat.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
