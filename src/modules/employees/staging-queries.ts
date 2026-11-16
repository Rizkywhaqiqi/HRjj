import type { RowDataPacket } from "mysql2/promise";
import { decryptField } from "@/core/crypto/field-encrypt";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";
import { parseExcelDate } from "./import-date";

export interface EmployeeStagingRow {
  id: number;
  source_row_number: number;
  application_id: number | null;
  full_name: string;
  review_flags: string[];
  created_at: string | Date;
}

export interface EmployeeStagingCompletion {
  fullName: string;
  nik: string;
  birthPlace: string;
  birthDate: string;
  addressCurrent: string;
  addressKtp: string;
  email: string;
  phone: string;
  companyId: string;
  positionId: string;
  locationId: string;
  joinDate: string;
  maritalStatus: string;
  childrenCount: string;
}

export interface EmployeeStagingDetail {
  id: number;
  source_row_number: number;
  application_id: number | null;
  full_name: string;
  review_flags: string[];
  source: {
    birthDetails: string;
    position: string;
    location: string;
    joinDate: string;
  };
  completion: EmployeeStagingCompletion;
}

interface EmployeeStagingDatabaseRow extends RowDataPacket {
  id: number;
  source_row_number: number;
  application_id: number | null;
  full_name: string;
  review_flags_text: string;
  created_at: string | Date;
}

interface EmployeeStagingDetailDatabaseRow extends RowDataPacket {
  id: number;
  source_row_number: number;
  application_id: number | null;
  full_name: string;
  payload_encrypted: string;
  review_flags_text: string;
}

function parseReviewFlags(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    parsed.some((flag) => typeof flag !== "string")
  ) {
    throw new Error("Invalid employee staging review flags.");
  }
  return parsed;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function textValue(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function maritalStatus(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("id-ID");
  if (normalized.includes("belum")) return "SINGLE";
  if (normalized.includes("cerai")) return "DIVORCED";
  if (normalized.includes("menikah")) return "MARRIED";
  return "";
}

function initialCompletion(
  payload: Record<string, unknown>,
  fullName: string,
  flags: string[],
): EmployeeStagingCompletion {
  const saved = objectValue(payload.__completion);
  const savedValue = (key: keyof EmployeeStagingCompletion, fallback = "") =>
    saved && typeof saved[key] === "string"
      ? saved[key] as string
      : fallback;
  const sourceNik = textValue(payload, "NIK").trim();
  const safeNik =
    !flags.includes("NIK_NUMERIC_EXCEL_REVIEW") && /^\d{16}$/.test(sourceNik)
      ? sourceNik
      : "";
  const sourceBirth = textValue(payload, "Tempat, Tanggal Lahir");
  const birthParts = sourceBirth.split(",");
  const sourceChildren = textValue(
    payload,
    "Jika sudah menikah, sudah mempunyai berapa anak?",
  ).trim();
  const childrenCount =
    /^\d{1,2}$/.test(sourceChildren) && Number(sourceChildren) <= 30
      ? sourceChildren
      : "";

  return {
    fullName: savedValue("fullName", fullName),
    nik: savedValue("nik", safeNik),
    birthPlace: savedValue("birthPlace", birthParts.length === 2 ? birthParts[0].trim() : ""),
    birthDate: savedValue("birthDate", parseExcelDate(birthParts[1]?.trim() ?? "") ?? ""),
    addressCurrent: savedValue("addressCurrent", textValue(payload, "Alamat Tinggal Saat ini?")),
    addressKtp: savedValue("addressKtp", textValue(payload, "Alamat Sesuai KTP?")),
    email: savedValue("email", textValue(payload, "Email?")),
    phone: savedValue("phone", textValue(payload, "Nomor Handphone")),
    companyId: savedValue("companyId"),
    positionId: savedValue("positionId"),
    locationId: savedValue("locationId"),
    joinDate: savedValue("joinDate", parseExcelDate(textValue(payload, "Tanggal Mulai Bergabung di Perusahaan?")) ?? ""),
    maritalStatus: savedValue("maritalStatus", maritalStatus(textValue(payload, "Status"))),
    childrenCount: savedValue("childrenCount", childrenCount),
  };
}

export async function countPendingEmployeeStaging(
  user: SessionUser,
  search: string,
): Promise<number> {
  const scope = directBrandScope(user, "s.brand_id");
  const rows = await queryRows<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total
     FROM employee_import_staging s
     WHERE s.status = 'PENDING' AND s.application_id IS NOT NULL
       AND s.full_name LIKE ? AND ${scope.clause}
       AND EXISTS (
         SELECT 1 FROM applications a
         WHERE a.id = s.application_id AND a.stage = 'ACCEPTED'
       )`,
    [`%${search}%`, ...scope.params],
  );
  return rows[0]?.total ?? 0;
}

export async function listPendingEmployeeStaging(
  user: SessionUser,
  search: string,
  limit: number,
  offset: number,
): Promise<EmployeeStagingRow[]> {
  const scope = directBrandScope(user, "s.brand_id");
  const rows = await queryRows<EmployeeStagingDatabaseRow>(
    `SELECT s.id, s.source_row_number, s.application_id, s.full_name,
            CAST(s.review_flags AS CHAR) AS review_flags_text, s.created_at
     FROM employee_import_staging s
     WHERE s.status = 'PENDING' AND s.application_id IS NOT NULL
       AND s.full_name LIKE ? AND ${scope.clause}
       AND EXISTS (
         SELECT 1 FROM applications a
         WHERE a.id = s.application_id AND a.stage = 'ACCEPTED'
       )
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT ? OFFSET ?`,
    [`%${search}%`, ...scope.params, limit, offset],
  );

  return rows.map((row) => ({
    id: row.id,
    source_row_number: row.source_row_number,
    application_id: row.application_id,
    full_name: row.full_name,
    review_flags: parseReviewFlags(row.review_flags_text),
    created_at: row.created_at,
  }));
}

export async function getPendingEmployeeStagingDetail(
  user: SessionUser,
  id: number,
): Promise<EmployeeStagingDetail | null> {
  const scope = directBrandScope(user, "s.brand_id");
  const rows = await queryRows<EmployeeStagingDetailDatabaseRow>(
    `SELECT s.id, s.source_row_number, s.application_id, s.full_name, s.payload_encrypted,
            CAST(s.review_flags AS CHAR) AS review_flags_text
     FROM employee_import_staging s
     WHERE s.id = ? AND s.status = 'PENDING'
       AND s.application_id IS NOT NULL AND ${scope.clause}
       AND EXISTS (
         SELECT 1 FROM applications a
         WHERE a.id = s.application_id AND a.stage = 'ACCEPTED'
       )
     LIMIT 1`,
    [id, ...scope.params],
  );
  const row = rows[0];
  if (!row) return null;

  const flags = parseReviewFlags(row.review_flags_text);
  const payload = objectValue(JSON.parse(decryptField(row.payload_encrypted)));
  if (!payload) throw new Error("Invalid employee staging payload.");

  return {
    id: row.id,
    source_row_number: row.source_row_number,
    application_id: row.application_id,
    full_name: row.full_name,
    review_flags: flags,
    source: {
      birthDetails: textValue(payload, "Tempat, Tanggal Lahir"),
      position: textValue(payload, "Posisi?"),
      location: textValue(payload, "Penempatan Kerja?"),
      joinDate: textValue(payload, "Tanggal Mulai Bergabung di Perusahaan?"),
    },
    completion: initialCompletion(payload, row.full_name, flags),
  };
}
