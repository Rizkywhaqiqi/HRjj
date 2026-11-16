import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import type { RowDataPacket } from "mysql2/promise";
import { executeSql, queryRows, withTransaction } from "@/core/db";
import { getSessionUser } from "@/core/auth/session";
import { hasPermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { assertBrandAccess } from "@/core/rbac/scope";
import { logAudit } from "@/core/audit/log";
import { employeeImportSchema, type EmployeeImportInput } from "@/modules/employees";
import { insertEmployeeRecord } from "@/modules/employees/insert-employee";
import { parseExcelDate } from "@/modules/employees/import-date";

export const maxDuration = 30;
const MAX_ROWS = 500;
interface OrgRow extends RowDataPacket { brand_id: number; location_brand_id: number | null; company_is_active: 0 | 1; position_is_active: 0 | 1; location_is_active: 0 | 1; }
interface BrandOrgRow extends RowDataPacket { brand_id: number; location_brand_id: number | null; position_is_active: 0 | 1; location_is_active: 0 | 1; }
interface ImportRow { row: number; data?: EmployeeImportInput; errors: string[]; }

function cellValue(cell: ExcelJS.Cell): unknown { const value = cell.value; if (value && typeof value === "object") { if ("formula" in value) throw new Error("Formula tidak diizinkan dalam file import."); if ("text" in value) return value.text; if ("result" in value) return value.result; } return value ?? ""; }
// ExcelJS's Node Buffer declaration is narrower than the Buffer returned by the current DOM/Node typings.
// @ts-expect-error ExcelJS accepts the runtime Buffer produced here.
async function parseRows(file: File): Promise<ImportRow[]> { const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await file.arrayBuffer())); const sheet = workbook.worksheets[0]; if (!sheet) throw new Error("Workbook tidak memiliki sheet."); const headers: string[] = []; sheet.getRow(1).eachCell((cell, columnNumber) => { headers[columnNumber] = String(cellValue(cell)).trim(); }); const raw: Record<string, unknown>[] = []; sheet.eachRow((row, rowNumber) => { if (rowNumber === 1) return; const values: Record<string, unknown> = {}; headers.forEach((header, columnNumber) => { if (header) values[header] = cellValue(row.getCell(columnNumber)); }); if (Object.values(values).some((value) => String(value).trim() !== "")) raw.push(values); }); if (raw.length > MAX_ROWS) throw new Error(`Maksimal ${MAX_ROWS} baris per import.`); return raw.map((row, index) => { const normalized: Record<string, unknown> = {}; for (const [key, value] of Object.entries(row)) normalized[key.trim()] = value; for (const key of ["birthDate", "joinDate"]) { const parsedDate = parseExcelDate(normalized[key], workbook.properties.date1904); if (parsedDate) normalized[key] = parsedDate; } const parsed = employeeImportSchema.safeParse(normalized); return parsed.success ? { row: index + 2, data: parsed.data, errors: [] } : { row: index + 2, errors: parsed.error.issues.map((issue) => { const field = issue.path[0]; return field === "birthDate" || field === "joinDate" ? `${field}: tanggal tidak terbaca. Gunakan tanggal Excel, YYYY-MM-DD, atau DD/MM/YYYY.` : `${issue.path.join(".")}: ${issue.message}`; }) }; }); }

export async function POST(request: Request) {
  const actor = await getSessionUser();
  if (!actor || !hasPermission(actor, PERMISSIONS.employeeCreate)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const form = await request.formData(); const file = form.get("file"); const mode = form.get("mode") === "commit" ? "commit" : "preview";
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "File Excel wajib dipilih." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Ukuran file maksimal 10 MB." }, { status: 400 });
  try {
    const rows = await parseRows(file); const codes = new Set<string>(); const niks = new Set<string>();
    for (const row of rows) if (row.data) { const code = row.data.employeeCode; if (code) { if (codes.has(code)) row.errors.push("Kode karyawan duplikat di file."); codes.add(code); } const nik = row.data.nik; if (nik) { if (niks.has(nik)) row.errors.push("NIK duplikat di file."); niks.add(nik); } }
    const invalid = rows.filter((row) => row.errors.length > 0);
    if (mode === "preview" || invalid.length > 0) return NextResponse.json({ total: rows.length, valid: rows.length - invalid.length, invalid: invalid.length, rows: rows.slice(0, 100).map((row) => ({ row: row.row, employeeCode: row.data?.employeeCode ?? null, fullName: row.data?.fullName ?? null, errors: row.errors })) });
    const employeeIds = await withTransaction(async (connection) => {
      const created: number[] = [];
      for (const row of rows) {
        const data = row.data as EmployeeImportInput;
        let brandId: number;
        if (data.companyId !== null) {
          const org = (await queryRows<OrgRow>(
            `SELECT c.brand_id, l.brand_id AS location_brand_id,
                    c.is_active AS company_is_active, p.is_active AS position_is_active,
                    l.is_active AS location_is_active
             FROM companies c
             INNER JOIN positions p ON p.id = ?
             INNER JOIN locations l ON l.id = ?
             WHERE c.id = ? LIMIT 1`,
            [data.positionId, data.locationId, data.companyId],
          ))[0];
          if (!org || !org.company_is_active || !org.position_is_active || !org.location_is_active ||
            (org.location_brand_id !== null && org.location_brand_id !== org.brand_id) ||
            (data.brandId !== null && data.brandId !== org.brand_id)) {
            throw new Error(`Baris ${row.row}: relasi organisasi tidak valid.`);
          }
          brandId = org.brand_id;
        } else {
          const org = (await queryRows<BrandOrgRow>(
            `SELECT b.id AS brand_id, l.brand_id AS location_brand_id,
                    p.is_active AS position_is_active, l.is_active AS location_is_active
             FROM brands b
             INNER JOIN positions p ON p.id = ?
             INNER JOIN locations l ON l.id = ?
             WHERE b.id = ? AND b.is_active = TRUE LIMIT 1`,
            [data.positionId, data.locationId, data.brandId],
          ))[0];
          if (!org || !org.position_is_active || !org.location_is_active ||
            (org.location_brand_id !== null && org.location_brand_id !== org.brand_id)) {
            throw new Error(`Baris ${row.row}: relasi organisasi tidak valid.`);
          }
          brandId = org.brand_id;
        }
        assertBrandAccess(actor, brandId);
        const employee = await insertEmployeeRecord(connection, { ...data, brandId }, null);
        created.push(employee.employeeId);
      }
      return created;
    });
    await executeSql("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'employee.import', 'employee_import', ?, ?)", [actor.id, randomUUID(), JSON.stringify({ count: employeeIds.length })]);
    return NextResponse.json({ committed: employeeIds.length });
  } catch (error) {
    await logAudit({
      userId: actor.id,
      action: "employee.import.failed",
      entityType: "employee_import",
      details: { errorType: error instanceof Error ? error.name : "unknown" },
    });
    return NextResponse.json({ error: "Import gagal. Periksa format dan relasi data pada file." }, { status: 400 });
  }
}
