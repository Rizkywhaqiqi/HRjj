import { createBlindIndex } from "@/core/crypto/field-encrypt";
import { importReferences } from "@/modules/employees/import-references";
import { resolveOrganizationName } from "@/modules/employees/import-format";
import { requireFeatureEnabled } from "@/core/rbac/guard";
import { MAX_UPLOAD_BYTES } from "@/core/storage/files";
import type { SessionUser } from "@/types/database";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import type { RowDataPacket } from "mysql2/promise";
import { queryRows, withTransaction } from "@/core/db";
import { getSessionUser } from "@/core/auth/session";
import { hasPermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { assertBrandAccess } from "@/core/rbac/scope";
import { logAudit } from "@/core/audit/log";
import {
  employeeImportSchema,
  type EmployeeImportInput,
} from "@/modules/employees";
import { insertEmployeeRecord } from "@/modules/employees/insert-employee";
import { parseExcelDate } from "@/modules/employees/import-date";

export const maxDuration = 30;
const MAX_ROWS = 500;
interface OrgRow extends RowDataPacket {
  brand_id: number;
  location_brand_id: number | null;
  company_is_active: 0 | 1;
  position_is_active: 0 | 1;
  location_is_active: 0 | 1;
}
interface BrandOrgRow extends RowDataPacket {
  brand_id: number;
  location_brand_id: number | null;
  position_is_active: 0 | 1;
  location_is_active: 0 | 1;
}
interface ImportRow {
  row: number;
  data?: EmployeeImportInput;
  errors: string[];
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value && typeof value === "object") {
    if ("formula" in value)
      throw new Error("Formula tidak diizinkan dalam file import.");
    if ("text" in value) return value.text;
    if ("result" in value) return value.result;
  }
  return value ?? "";
}
// ExcelJS's Node Buffer declaration is narrower than the Buffer returned by the current DOM/Node typings.
async function parseRows(file: File, actor: SessionUser): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(await file.arrayBuffer()) as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0],
  );
  const references = await importReferences(actor);
  const sheet = workbook.getWorksheet("Karyawan") ?? workbook.worksheets[0];
  if (!sheet) throw new Error("Workbook tidak memiliki sheet.");
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    headers[columnNumber] = String(cellValue(cell)).trim();
  });
  const raw: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, unknown> = {};
    headers.forEach((header, columnNumber) => {
      if (header) values[header] = cellValue(row.getCell(columnNumber));
    });
    if (Object.values(values).some((value) => String(value).trim() !== ""))
      raw.push({ ...values, __rowNumber: rowNumber });
  });
  if (raw.length > MAX_ROWS)
    throw new Error(`Maksimal ${MAX_ROWS} baris per import.`);
  return raw.map((row) => {
    const rowNumber = Number(row.__rowNumber);
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row))
      normalized[key.trim()] = value;
    for (const key of ["birthDate", "joinDate"]) {
      const parsedDate = parseExcelDate(
        normalized[key],
        workbook.properties.date1904,
      );
      if (parsedDate) normalized[key] = parsedDate;
    }
    try {
      for (const [id, name, options, label] of [
        ["brandId", "brandName", references.brands, "Brand"],
        ["companyId", "companyName", references.companies, "Perusahaan"],
        ["positionId", "positionName", references.positions, "Jabatan"],
        ["locationId", "locationName", references.locations, "Lokasi"],
      ] as const) {
        if (String(normalized[name] ?? "").trim()) {
          let candidates = options;
          if (id === "companyId" && normalized.brandId)
            candidates = options.filter(
              (o) => o.parentId === Number(normalized.brandId),
            );
          if (id === "locationId") {
            const brand =
              Number(normalized.brandId) ||
              references.companies.find(
                (c) => c.id === Number(normalized.companyId),
              )?.parentId;
            if (brand)
              candidates = options.filter(
                (o) =>
                  o.parentId === null ||
                  o.parentId === undefined ||
                  o.parentId === brand,
              );
          }
          const resolved = resolveOrganizationName(
            normalized[name],
            candidates,
            label,
          );
          if (normalized[id] && Number(normalized[id]) !== resolved)
            throw new Error(`${label}: ID dan nama tidak cocok.`);
          normalized[id] = resolved;
        }
      }
    } catch (error) {
      return {
        row: rowNumber,
        errors: [
          error instanceof Error ? error.message : "Organisasi tidak valid",
        ],
      };
    }
    const parsed = employeeImportSchema.safeParse(normalized);
    return parsed.success
      ? { row: rowNumber, data: parsed.data, errors: [] }
      : {
          row: rowNumber,
          errors: parsed.error.issues.map((issue) => {
            const field = issue.path[0];
            return field === "birthDate" || field === "joinDate"
              ? `${field}: tanggal tidak terbaca. Gunakan tanggal Excel, YYYY-MM-DD, atau DD/MM/YYYY.`
              : `${issue.path.join(".")}: ${issue.message}`;
          }),
        };
  });
}

export async function POST(request: Request) {
  const actor = await getSessionUser();
  if (!actor || !hasPermission(actor, PERMISSIONS.employeeCreate))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await requireFeatureEnabled("employees");
  const form = await request.formData();
  const file = form.get("file");
  const mode = form.get("mode") === "commit" ? "commit" : "preview";
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json(
      { error: "File Excel wajib dipilih." },
      { status: 400 },
    );
  if (file.size > MAX_UPLOAD_BYTES)
    return NextResponse.json(
      { error: "Ukuran file maksimal 1,5 MB." },
      { status: 400 },
    );
  try {
    const rows = await parseRows(file, actor);
    const codes = new Set<string>();
    const niks = new Set<string>();
    for (const row of rows)
      if (row.data) {
        const code = row.data.employeeCode;
        if (code) {
          if (codes.has(code.toLowerCase()))
            row.errors.push("Kode karyawan duplikat di file.");
          codes.add(code.toLowerCase());
        }
        const nik = row.data.nik;
        if (nik) {
          if (niks.has(nik)) row.errors.push("NIK duplikat di file.");
          niks.add(nik);
        }
      }
    if (!rows.length)
      return NextResponse.json(
        { error: "File tidak berisi data karyawan." },
        { status: 400 },
      );
    const codeValues = [...codes];
    const nikHashes = [...niks].map(createBlindIndex);
    const existingCodes = codeValues.length
      ? await queryRows<RowDataPacket>(
          `SELECT employee_code FROM employees WHERE employee_code IN (${codeValues.map(() => "?").join(",")})`,
          codeValues,
        )
      : [];
    const existingNiks = nikHashes.length
      ? await queryRows<RowDataPacket>(
          `SELECT nik_hash FROM employees WHERE nik_hash IN (${nikHashes.map(() => "?").join(",")})`,
          nikHashes,
        )
      : [];
    const usedCodes = new Set(
      existingCodes.map((r) => String(r.employee_code).toLowerCase()),
    );
    const usedNiks = new Set(existingNiks.map((r) => r.nik_hash));
    const refs = await importReferences(actor);
    for (const row of rows)
      if (row.data) {
        const d = row.data;
        const company = refs.companies.find((c) => c.id === d.companyId);
        const brand = company?.parentId ?? d.brandId;
        const loc = refs.locations.find((l) => l.id === d.locationId);
        if (
          !brand ||
          !refs.brands.some((b) => b.id === brand) ||
          (d.companyId && !company) ||
          (d.brandId && d.brandId !== brand) ||
          !refs.positions.some((p) => p.id === d.positionId) ||
          !loc ||
          (loc.parentId && loc.parentId !== brand)
        )
          row.errors.push(
            "Organisasi tidak aktif, tidak cocok, atau di luar akses Anda.",
          );
        if (d.employeeCode && usedCodes.has(d.employeeCode.toLowerCase()))
          row.errors.push(
            "Kode karyawan sudah tersimpan. Data tidak akan ditimpa.",
          );
        if (d.nik && usedNiks.has(createBlindIndex(d.nik)))
          row.errors.push(
            "Identitas sudah tersimpan. Data tidak akan digandakan.",
          );
      }
    const invalid = rows.filter((row) => row.errors.length > 0);
    if (mode === "preview" || invalid.length > 0)
      return NextResponse.json({
        total: rows.length,
        valid: rows.length - invalid.length,
        invalid: invalid.length,
        rows: rows.map((row) => ({
          row: row.row,
          employeeCode: row.data?.employeeCode ?? null,
          fullName: row.data?.fullName ?? null,
          errors: row.errors,
        })),
      });
    const employeeIds = await withTransaction(async (connection) => {
      const created: number[] = [];
      const organizations = new Map<string, RowDataPacket[]>();
      async function organization<T extends RowDataPacket>(sql: string, params: (number | null)[]): Promise<T[]> {
        const key = JSON.stringify([sql, params]);
        const cached = organizations.get(key);
        if (cached) return cached as T[];
        const [result] = await connection.execute<T[]>(sql + " FOR SHARE", params);
        organizations.set(key, result);
        return result;
      }
      for (const row of rows) {
        const data = row.data as EmployeeImportInput;
        let brandId: number;
        if (data.companyId !== null) {
          const org = (
            await organization<OrgRow>(
              `SELECT c.brand_id, l.brand_id AS location_brand_id,
                    c.is_active AS company_is_active, p.is_active AS position_is_active,
                    l.is_active AS location_is_active
             FROM companies c
             INNER JOIN positions p ON p.id = ?
             INNER JOIN locations l ON l.id = ?
             WHERE c.id = ? LIMIT 1`,
              [data.positionId, data.locationId, data.companyId],
            )
          )[0];
          if (
            !org ||
            !org.company_is_active ||
            !org.position_is_active ||
            !org.location_is_active ||
            (org.location_brand_id !== null &&
              org.location_brand_id !== org.brand_id) ||
            (data.brandId !== null && data.brandId !== org.brand_id)
          ) {
            throw new Error(`Baris ${row.row}: relasi organisasi tidak valid.`);
          }
          brandId = org.brand_id;
        } else {
          const org = (
            await organization<BrandOrgRow>(
              `SELECT b.id AS brand_id, l.brand_id AS location_brand_id,
                    p.is_active AS position_is_active, l.is_active AS location_is_active
             FROM brands b
             INNER JOIN positions p ON p.id = ?
             INNER JOIN locations l ON l.id = ?
             WHERE b.id = ? AND b.is_active = TRUE LIMIT 1`,
              [data.positionId, data.locationId, data.brandId],
            )
          )[0];
          if (
            !org ||
            !org.position_is_active ||
            !org.location_is_active ||
            (org.location_brand_id !== null &&
              org.location_brand_id !== org.brand_id)
          ) {
            throw new Error(`Baris ${row.row}: relasi organisasi tidak valid.`);
          }
          brandId = org.brand_id;
        }
        assertBrandAccess(actor, brandId);
        const employee = await insertEmployeeRecord(
          connection,
          { ...data, brandId },
          null,
        );
        created.push(employee.employeeId);
      }
      return created;
    });
    await logAudit({
      userId: actor.id,
      action: "employee.import",
      entityType: "employee_import",
      entityId: randomUUID(),
      details: { count: employeeIds.length },
    });
    return NextResponse.json({ committed: employeeIds.length });
  } catch (error) {
    await logAudit({
      userId: actor.id,
      action: "employee.import.failed",
      entityType: "employee_import",
      details: { errorType: error instanceof Error ? error.name : "unknown" },
    });
    return NextResponse.json(
      { error: "Import gagal. Periksa format dan relasi data pada file." },
      { status: 400 },
    );
  }
}
