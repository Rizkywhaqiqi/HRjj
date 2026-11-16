import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getSessionUser } from "@/core/auth/session";
import { hashPassword } from "@/core/auth/password";
import { logAudit } from "@/core/audit/log";
import { queryRows, withTransaction } from "@/core/db";
import { isFeatureEnabled, hasPermission } from "@/core/rbac/guard";
import { brandScope } from "@/core/rbac/scope";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { candidateImportRowSchema } from "@/modules/recruitment/schema";
import type { z } from "zod";

export const maxDuration = 30;

const MAX_ROWS = 500;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CONSENT_POLICY_VERSION = "2026-01";
type CandidateImportInput = z.output<typeof candidateImportRowSchema>;

interface ParsedRow {
  row: number;
  data?: CandidateImportInput;
  fullName: string | null;
  email: string | null;
  errors: string[];
}

interface CandidateAccountRow extends RowDataPacket {
  id: number;
  email: string;
  phone: string;
  candidate_id: number | null;
}

interface VacancyRow extends RowDataPacket {
  id: number;
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value && typeof value === "object") {
    if ("formula" in value) {
      throw new Error("Formula tidak diizinkan dalam file import.");
    }
    if ("text" in value) return value.text;
    if ("result" in value) return value.result;
  }
  return value ?? "";
}

function normalizedHeader(value: unknown): string {
  return String(value).trim().toLocaleLowerCase("id-ID").replace(/[\s_-]+/g, "");
}

const HEADER_KEYS: Record<string, string> = {
  fullname: "fullName",
  nama: "fullName",
  email: "email",
  phone: "phone",
  nomorhp: "phone",
  telepon: "phone",
  consent: "consent",
  persetujuan: "consent",
};

async function parseRows(file: File): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error ExcelJS accepts the runtime Buffer produced here.
  await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()));
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Workbook tidak memiliki sheet.");

  const headers: Array<{ column: number; key: string }> = [];
  sheet.getRow(1).eachCell((cell, column) => {
    const key = HEADER_KEYS[normalizedHeader(cellValue(cell))];
    if (key) headers.push({ column, key });
  });
  const requiredHeaders = ["fullName", "email", "phone", "consent"];
  const foundHeaders = new Set(headers.map((header) => header.key));
  const missingHeaders = requiredHeaders.filter((header) => !foundHeaders.has(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Kolom wajib tidak ditemukan: ${missingHeaders.join(", ")}.`);
  }

  const rawRows: Array<{ row: number; values: Record<string, unknown> }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, unknown> = {};
    for (const header of headers) values[header.key] = cellValue(row.getCell(header.column));
    if (Object.values(values).some((value) => String(value).trim() !== "")) {
      rawRows.push({ row: rowNumber, values });
    }
  });
  if (rawRows.length === 0) throw new Error("File tidak berisi data kandidat.");
  if (rawRows.length > MAX_ROWS) throw new Error(`Maksimal ${MAX_ROWS} baris per import.`);

  return rawRows.map(({ row, values }) => {
    const parsed = candidateImportRowSchema.safeParse(values);
    if (!parsed.success) {
      return {
        row,
        fullName: String(values.fullName ?? "").trim() || null,
        email: String(values.email ?? "").trim() || null,
        errors: parsed.error.issues.map((issue) =>
          `${String(issue.path[0] ?? "data")}: ${issue.message}`,
        ),
      };
    }
    return {
      row,
      data: parsed.data,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      errors: [],
    };
  });
}

function addFileDuplicates(rows: ParsedRow[]): void {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const row of rows) {
    if (!row.data) continue;
    if (emails.has(row.data.email)) row.errors.push("Email duplikat di file.");
    if (phones.has(row.data.phone)) row.errors.push("Nomor telepon duplikat di file.");
    emails.add(row.data.email);
    phones.add(row.data.phone);
  }
}

async function findExistingCandidate(
  email: string,
  phone: string,
): Promise<{ candidateId: number | null; error: string | null }> {
  const rows = await queryRows<CandidateAccountRow>(
    `SELECT ca.id, ca.email, ca.phone, c.id AS candidate_id
     FROM candidate_accounts ca
     LEFT JOIN candidates c ON c.account_id = ca.id
     WHERE ca.email = ? OR ca.phone = ?`,
    [email, phone],
  );
  if (rows.length === 0) return { candidateId: null, error: null };
  if (
    rows.length !== 1 ||
    rows[0].email.toLocaleLowerCase("id-ID") !== email ||
    rows[0].phone !== phone ||
    rows[0].candidate_id === null
  ) {
    return {
      candidateId: null,
      error: "Email atau nomor telepon sudah terhubung ke akun kandidat lain.",
    };
  }
  return { candidateId: rows[0].candidate_id, error: null };
}

async function addDatabaseErrors(rows: ParsedRow[], vacancyId: number): Promise<void> {
  for (const row of rows) {
    if (!row.data || row.errors.length > 0) continue;
    const existing = await findExistingCandidate(row.data.email, row.data.phone);
    if (existing.error) {
      row.errors.push(existing.error);
      continue;
    }
    if (existing.candidateId === null) continue;
    const applications = await queryRows<RowDataPacket>(
      "SELECT id FROM applications WHERE vacancy_id = ? AND candidate_id = ? LIMIT 1",
      [vacancyId, existing.candidateId],
    );
    if (applications.length > 0) {
      row.errors.push("Kandidat sudah memiliki lamaran pada lowongan ini.");
    }
  }
}

export async function POST(request: Request) {
  const actor = await getSessionUser();
  if (!actor || !hasPermission(actor, PERMISSIONS.recruitmentManage)) {
    return NextResponse.json({ error: "Tidak memiliki akses." }, { status: 403 });
  }
  if (!(await isFeatureEnabled("recruitment"))) {
    return NextResponse.json({ error: "Fitur rekrutmen sedang dinonaktifkan." }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const vacancyId = Number(form.get("vacancyId"));
  const mode = form.get("mode") === "commit" ? "commit" : "preview";
  if (!Number.isSafeInteger(vacancyId) || vacancyId <= 0) {
    return NextResponse.json({ error: "Pilih lowongan yang valid." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File XLSX wajib dipilih." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE || !file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "File harus XLSX dan maksimal 10 MB." }, { status: 400 });
  }

  const scope = brandScope(actor, "v.company_id");
  const vacancies = await queryRows<VacancyRow>(
    `SELECT v.id FROM vacancies v
     WHERE v.id = ? AND v.status = 'OPEN' AND ${scope.clause}
     LIMIT 1`,
    [vacancyId, ...scope.params],
  );
  if (!vacancies[0]) {
    return NextResponse.json({ error: "Lowongan tidak terbuka atau di luar scope Anda." }, { status: 400 });
  }

  try {
    const rows = await parseRows(file);
    addFileDuplicates(rows);
    await addDatabaseErrors(rows, vacancyId);
    const invalid = rows.filter((row) => row.errors.length > 0);
    if (mode === "preview" || invalid.length > 0) {
      return NextResponse.json({
        total: rows.length,
        valid: rows.length - invalid.length,
        invalid: invalid.length,
        rows: invalid.map(({ row, fullName, email, errors }) => ({
          row,
          fullName,
          email,
          errors,
        })),
      });
    }

    // Imported applicants have no portal password-reset flow yet; their random credential is never disclosed.
    const importedPasswordHash = await hashPassword(randomUUID());
    await withTransaction(async (connection) => {
      for (const row of rows) {
        const data = row.data;
        if (!data) throw new Error("IMPORT_ROW_INVALID");
        const [accountRows] = await connection.execute<CandidateAccountRow[]>(
          `SELECT ca.id, ca.email, ca.phone, c.id AS candidate_id
           FROM candidate_accounts ca
           LEFT JOIN candidates c ON c.account_id = ca.id
           WHERE ca.email = ? OR ca.phone = ?
           FOR UPDATE`,
          [data.email, data.phone],
        );
        let candidateId: number;
        if (accountRows.length > 0) {
          const account = accountRows[0];
          if (
            accountRows.length !== 1 ||
            account.email.toLocaleLowerCase("id-ID") !== data.email ||
            account.phone !== data.phone ||
            account.candidate_id === null
          ) {
            throw new Error("CANDIDATE_IDENTITY_CONFLICT");
          }
          candidateId = account.candidate_id;
        } else {
          const [accountResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO candidate_accounts (full_name, email, phone, password_hash)
             VALUES (?, ?, ?, ?)`,
            [data.fullName, data.email, data.phone, importedPasswordHash],
          );
          const [candidateResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO candidates (account_id, full_name, email, phone)
             VALUES (?, ?, ?, ?)`,
            [accountResult.insertId, data.fullName, data.email, data.phone],
          );
          candidateId = candidateResult.insertId;
        }
        await connection.execute(
          `INSERT INTO applications
            (vacancy_id, candidate_id, consent_given, consent_at, consent_policy_version)
           VALUES (?, ?, TRUE, NOW(), ?)`,
          [vacancyId, candidateId, CONSENT_POLICY_VERSION],
        );
      }
    });

    await logAudit({
      userId: actor.id,
      action: "recruitment.candidate.import",
      entityType: "vacancy",
      entityId: vacancyId,
      details: { count: rows.length },
    });
    return NextResponse.json({ committed: rows.length });
  } catch (error) {
    await logAudit({
      userId: actor.id,
      action: "recruitment.candidate.import.failed",
      entityType: "vacancy",
      entityId: vacancyId,
      details: { errorType: error instanceof Error ? error.name : "unknown" },
    });
    const message = error instanceof Error && error.message === "CANDIDATE_IDENTITY_CONFLICT"
      ? "Email atau nomor telepon berubah saat import. Periksa file lalu preview kembali."
      : error instanceof Error && error.message === "ER_DUP_ENTRY"
        ? "Ada kandidat duplikat atau lamaran sudah dibuat. Preview kembali sebelum menyimpan."
        : "Import kandidat gagal. Periksa file dan coba lagi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
