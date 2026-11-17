"use server";

import { deleteStoredFile, MAX_UPLOAD_BYTES, putStoredFile, readStoredFile } from "@/core/storage/files";
import path from "node:path";
import { randomUUID } from "node:crypto";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeSql, queryRows, withTransaction } from "@/core/db";
import { logAudit } from "@/core/audit/log";
import { firstIssueMessage, redirectWithMessage } from "@/core/http/navigation";
import { assertBrandAccess } from "@/core/rbac/scope";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { createBuiltInOfferLetterTemplate } from "./builtin-template";
import { letterCreateSchema, letterTemplateSchema } from "./schema";

const PATH = "/letters";
function fail(message: string, path = PATH): never { return redirectWithMessage(path, "error", message); }
interface EmployeeLetterRow extends RowDataPacket { employee_id: number; employee_code: string; full_name: string; position_name: string; location_name: string; location_city: string | null; company_id: number | null; company_name: string | null; company_address: string | null; company_phone: string | null; brand_id: number; brand_code: string; }
interface TemplateRow extends RowDataPacket { id: number; file_path: string; version: number; }
interface LetterDeleteRow extends RowDataPacket { file_path: string; letter_number: string; status: string; }
interface ContractLetterRow extends RowDataPacket {
  id: number;
  employee_id: number;
  contract_type_name: string;
  contract_start_date: string;
  contract_end_date: string | null;
  base_salary: string | null;
  is_permanent: 0 | 1;
  letter_id: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatLetterDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function isGeneratedLetterPath(value: string): boolean {
  return value.startsWith("letters/") &&
    !value.includes("..") &&
    !value.includes("\\") &&
    !path.isAbsolute(value) &&
    value.endsWith(".docx");
}

export async function uploadLetterTemplateAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.letterCreate);
  const parsed = letterTemplateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) fail(firstIssueMessage(parsed.error));
  const file = formData.get("template");
  if (!(file instanceof File) || file.size === 0) fail("File template DOCX wajib dipilih.");
  if (file.size > MAX_UPLOAD_BYTES || file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") fail("Template harus DOCX dan maksimal 1,5 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const zip = new PizZip(bytes);
    if (!zip.file("[Content_Types].xml") || !zip.file("word/document.xml")) fail("Isi file template DOCX tidak valid.");
  } catch { fail("Isi file template DOCX tidak valid."); }
  const companyId: number | null = parsed.data.companyId ?? null;
  if (companyId !== null) {
    const rows = await queryRows<RowDataPacket>("SELECT brand_id FROM companies WHERE id=? AND is_active=TRUE LIMIT 1", [companyId]);
    if (!rows[0]) fail("CV template tidak ditemukan.");
    assertBrandAccess(actor, Number(rows[0].brand_id));
  }
  const filePath = `${randomUUID()}.docx`;
  try {
    await putStoredFile(`templates/letters/${filePath}`, bytes);
    const versions = await queryRows<RowDataPacket>("SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM letter_templates WHERE type=? AND (company_id=? OR (company_id IS NULL AND ? IS NULL))", [parsed.data.type, companyId, companyId]);
    await executeSql("INSERT INTO letter_templates (type, company_id, name, file_path, version) VALUES (?, ?, ?, ?, ?)", [parsed.data.type, companyId, parsed.data.name, filePath, Number(versions[0]?.next_version ?? 1)]);
  } catch { fail("Template gagal disimpan."); }
  redirectWithMessage(PATH, "ok", "Template surat berhasil diunggah.");
}

export async function setLetterTemplateActiveAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.letterCreate);
  const id = Number(formData.get("templateId"));
  if (!Number.isInteger(id) || id <= 0) fail("ID template tidak valid.");
  const nextActive = formData.get("nextActive") === "1";
  const result = await executeSql("UPDATE letter_templates t LEFT JOIN companies c ON c.id=t.company_id SET t.is_active=? WHERE t.id=? AND (t.company_id IS NULL OR ? OR c.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id=?))", [nextActive, id, actor.scopeAll, actor.id]);
  if (result.affectedRows !== 1) fail("Template tidak ditemukan atau di luar scope.");
  await logAudit({ userId: actor.id, action: nextActive ? "letter.template.activate" : "letter.template.deactivate", entityType: "letter_template", entityId: id, details: { isActive: nextActive } });
  redirectWithMessage(PATH, "ok", `Template berhasil ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`);
}

export async function createLetterAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.letterCreate);
  await requireFeatureEnabled("letters");
  const formParams = new URLSearchParams();
  const submittedEmployeeId = Number(formData.get("employeeId"));
  const submittedContractId = Number(formData.get("contractId"));
  const submittedType = formData.get("type");
  const submittedFlow = formData.get("flow");
  const returnPath =
    formData.get("returnPath") === "/employees" ? "/employees" : PATH;
  if (Number.isSafeInteger(submittedEmployeeId) && submittedEmployeeId > 0) {
    formParams.set("employeeId", String(submittedEmployeeId));
  }
  if (Number.isSafeInteger(submittedContractId) && submittedContractId > 0) {
    formParams.set("contractId", String(submittedContractId));
  }
  if (typeof submittedType === "string") formParams.set("type", submittedType);
  if (typeof submittedFlow === "string") formParams.set("flow", submittedFlow);
  const formPath =
    returnPath === PATH && formParams.toString()
      ? `${PATH}?${formParams}`
      : returnPath;
  const parsed = letterCreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) fail(firstIssueMessage(parsed.error), formPath);
  const data = parsed.data;
  if (data.contractId && data.type !== "CONTRACT") {
    fail("Data kontrak hanya dapat digunakan untuk membuat surat kontrak.", formPath);
  }
  const employees = await queryRows<EmployeeLetterRow>(`SELECT e.id AS employee_id, e.employee_code, e.full_name, p.name AS position_name, l.name AS location_name, l.city AS location_city, e.company_id, c.name AS company_name, c.address AS company_address, c.phone AS company_phone, e.brand_id, b.code AS brand_code FROM employees e LEFT JOIN companies c ON c.id=e.company_id INNER JOIN brands b ON b.id=e.brand_id INNER JOIN positions p ON p.id=e.position_id INNER JOIN locations l ON l.id=e.location_id WHERE e.id=? AND e.is_active=TRUE LIMIT 1`, [data.employeeId]);
  const employee = employees[0];
  if (!employee) fail("Karyawan aktif tidak ditemukan.", formPath);
  assertBrandAccess(actor, employee.brand_id);
  const contract = data.contractId
    ? (await queryRows<ContractLetterRow>(
      `SELECT ct.id, ct.employee_id, ty.name AS contract_type_name,
              DATE_FORMAT(ct.start_date, '%Y-%m-%d') AS contract_start_date,
              DATE_FORMAT(ct.end_date, '%Y-%m-%d') AS contract_end_date,
              ct.base_salary, ty.is_permanent, ct.letter_id
       FROM contracts ct
       INNER JOIN contract_types ty ON ty.id=ct.contract_type_id
       WHERE ct.id=? AND ct.employee_id=? AND ct.status='RUNNING'
       LIMIT 1`,
      [data.contractId, employee.employee_id],
    ))[0]
    : null;
  if (data.contractId && !contract) {
    fail("Kontrak tidak ditemukan, tidak aktif, atau berada di luar akses Anda.", formPath);
  }
  const linkContract = Boolean(contract && data.linkContract !== false);
  if (linkContract && contract?.letter_id !== null) {
    fail("Kontrak ini sudah memiliki surat. Gunakan mode penawaran perpanjangan.", formPath);
  }
  const templates = await queryRows<TemplateRow>("SELECT id, file_path, version FROM letter_templates WHERE type = ? AND is_active = TRUE AND (company_id = ? OR company_id IS NULL) ORDER BY company_id IS NULL, version DESC LIMIT 1", [data.type, employee.company_id]);
  const template = templates[0];
  if (!template && data.type !== "CONTRACT") fail("Template surat belum tersedia untuk jenis ini.", formPath);
  if (template && (path.isAbsolute(template.file_path) || template.file_path.includes("..") || !template.file_path.endsWith(".docx"))) {
    fail("Template surat tidak valid.", formPath);
  }
  let metadata: Record<string, unknown> = {};
  if (data.metadata) {
    let parsedMetadata: unknown;
    try {
      parsedMetadata = JSON.parse(data.metadata);
    } catch {
      fail("Metadata surat harus berupa JSON yang valid.", formPath);
    }
    if (!isRecord(parsedMetadata)) fail("Metadata surat harus berupa objek JSON.", formPath);
    metadata = parsedMetadata;
  }
  const offerStartDate = data.offerStartDate !== undefined
    ? data.offerStartDate
    : contract?.contract_start_date ?? null;
  const offerEndDate = data.offerEndDate !== undefined
    ? data.offerEndDate
    : contract?.contract_end_date ?? null;
  const offeredSalary = data.offeredSalary !== undefined
    ? data.offeredSalary
    : contract?.base_salary === null || contract?.base_salary === undefined
      ? null
      : Number(contract.base_salary);
  if (data.type === "CONTRACT") {
    if (!offerStartDate) fail("Tanggal mulai penawaran wajib diisi.", formPath);
    if (contract && !contract.is_permanent && !offerEndDate) {
      fail("Tanggal akhir wajib untuk penawaran kontrak berjangka.", formPath);
    }
    if (offerEndDate && offerStartDate && offerEndDate < offerStartDate) {
      fail("Tanggal akhir penawaran tidak boleh sebelum tanggal mulai.", formPath);
    }
    if (offeredSalary === null || !Number.isFinite(offeredSalary)) {
      fail("Gaji pokok penawaran wajib diisi.", formPath);
    }
  }
  const contractMetadata = data.type === "CONTRACT"
    ? {
        contract_type_name: data.offeredContractType?.trim() || contract?.contract_type_name || "-",
        contract_start_date: formatLetterDate(offerStartDate),
        contract_end_date: formatLetterDate(offerEndDate),
        offer_start_date: formatLetterDate(offerStartDate),
        offer_end_date: formatLetterDate(offerEndDate),
        offered_salary: offeredSalary === null ? "" : new Intl.NumberFormat("id-ID").format(offeredSalary),
        base_salary: offeredSalary === null ? "" : new Intl.NumberFormat("id-ID").format(offeredSalary),
        reporting_to: data.reportingTo?.trim() || "-",
        training_period: data.trainingPeriod?.trim() || "2 Bulan",
        work_hours: data.workHours?.trim() || "08.00 - 17.00 WIB",
        source_contract_id: contract?.id ?? null,
      }
    : {};
  try {
    const content = template
      ? await readStoredFile(`templates/letters/${template.file_path}`)
      : createBuiltInOfferLetterTemplate();
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    const storedMetadata = { ...metadata, ...contractMetadata };
    doc.render({
      ...storedMetadata,
      employee_code: employee.employee_code,
      company_address: employee.company_address?.trim() || "-",
      company_phone: employee.company_phone?.trim() || "-",
      full_name: employee.full_name?.trim() || "-",
      company_name: employee.company_name?.trim() || "-",
      position_name: employee.position_name?.trim() || "-",
      location_name: employee.location_name?.trim() || "-",
      location_city: employee.location_city?.trim() || employee.location_name?.trim() || "-",
      issued_date: formatLetterDate(data.issuedDate),
    });
    const output = doc.getZip().generate({ type: "nodebuffer" });
    const result = await withTransaction(async (connection) => {
      let letterNumber: string;
      if (employee.company_id !== null) {
        await connection.execute("INSERT INTO letter_sequences (company_id, letter_year, next_number) VALUES (?, YEAR(?), 1) ON DUPLICATE KEY UPDATE next_number = next_number", [employee.company_id, data.issuedDate]);
        const [sequenceRows] = await connection.execute<RowDataPacket[]>("SELECT next_number FROM letter_sequences WHERE company_id = ? AND letter_year = YEAR(?) FOR UPDATE", [employee.company_id, data.issuedDate]);
        const number = Number(sequenceRows[0]?.next_number ?? 1);
        await connection.execute("UPDATE letter_sequences SET next_number = next_number + 1 WHERE company_id = ? AND letter_year = YEAR(?)", [employee.company_id, data.issuedDate]);
        letterNumber = `${employee.brand_code}/${data.type}/${new Date(data.issuedDate).getFullYear()}/${String(number).padStart(4, "0")}`;
      } else {
        letterNumber = `${employee.brand_code}/${data.type}/${new Date(data.issuedDate).getFullYear()}/NO-CV-${randomUUID().slice(0, 8).toUpperCase()}`;
      }
      const relativePath = `letters/${employee.company_id ?? "no-company"}-${letterNumber.replaceAll("/", "-")}-${randomUUID()}.docx`;
      const [insert] = await connection.execute<ResultSetHeader>(`INSERT INTO letters (letter_number, type, employee_id, company_id, template_id, file_path, status, issued_date, metadata, created_by) VALUES (?, ?, ?, ?, ?, ?, 'ISSUED', ?, ?, ?)`, [letterNumber, data.type, employee.employee_id, employee.company_id, template?.id ?? null, relativePath, data.issuedDate, JSON.stringify(storedMetadata), actor.id]);
      if (linkContract && contract) {
        const [linked] = await connection.execute<ResultSetHeader>(
          "UPDATE contracts SET letter_id=? WHERE id=? AND employee_id=? AND status='RUNNING' AND letter_id IS NULL",
          [insert.insertId, contract.id, employee.employee_id],
        );
        if (linked.affectedRows !== 1) throw new Error("CONTRACT_LETTER_ALREADY_LINKED");
      }
      return { id: insert.insertId, relativePath };
    });
    try {
      await putStoredFile(`private/${result.relativePath}`, output);
    } catch (writeError) {
      try {
        await withTransaction(async (connection) => {
          if (linkContract && contract) {
            await connection.execute("UPDATE contracts SET letter_id=NULL WHERE id=? AND letter_id=?", [contract.id, result.id]);
          }
          await connection.execute("DELETE FROM letters WHERE id=? AND status='ISSUED'", [result.id]);
        });
        await deleteStoredFile(`private/${result.relativePath}`);
      } catch (cleanupError) {
        if (!(typeof cleanupError === "object" && cleanupError !== null && "code" in cleanupError && cleanupError.code === "ENOENT")) {
          console.error("[letters] failed generation cleanup", {
            letterId: result.id,
            error: cleanupError instanceof Error ? cleanupError.name : "unknown",
          });
        }
      }
      throw writeError;
    }
    await logAudit({
      userId: actor.id,
      action: "letter.create",
      entityType: "letter",
      entityId: result.id,
      details: {
        type: data.type,
        employeeId: data.employeeId,
        contractId: contract?.id ?? null,
        linkedToContract: linkContract,
        builtInTemplate: !template && data.type === "CONTRACT",
      },
    });
  } catch (error) {
    console.error("[letters] generation failed", error instanceof Error ? error.name : "unknown");
    if (error instanceof Error && error.message === "CONTRACT_LETTER_ALREADY_LINKED") {
      fail("Kontrak sudah memiliki surat atau tidak lagi aktif.", formPath);
    }
    fail("Surat gagal dibuat. Pastikan template DOCX tersedia dan valid.", formPath);
  }
  redirectWithMessage(returnPath, "ok", "Surat berhasil dibuat.");
}

export async function submitLetterForApprovalAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.letterCreate);
  const id = Number(formData.get("letterId"));
  if (!Number.isInteger(id) || id <= 0) fail("ID surat tidak valid.");
  const result = await executeSql("UPDATE letters l INNER JOIN employees e ON e.id=l.employee_id SET l.status='PENDING_APPROVAL' WHERE l.id=? AND l.status='DRAFT' AND (? OR e.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id=?))", [id, actor.scopeAll, actor.id]);
  if (result.affectedRows !== 1) fail("Surat tidak ditemukan atau tidak dapat diajukan.");
  await logAudit({ userId: actor.id, action: "letter.submit_approval", entityType: "letter", entityId: id });
  redirectWithMessage(PATH, "ok", "Surat diajukan untuk persetujuan.");
}

export async function approveLetterAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.letterApprove);
  const id = Number(formData.get("letterId"));
  if (!Number.isInteger(id) || id <= 0) fail("ID surat tidak valid.");
  const result = await executeSql("UPDATE letters l INNER JOIN employees e ON e.id=l.employee_id SET l.status='APPROVED', l.approved_by=? WHERE l.id=? AND l.status='PENDING_APPROVAL' AND (? OR e.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id=?))", [actor.id, id, actor.scopeAll, actor.id]);
  if (result.affectedRows !== 1) fail("Surat tidak ditemukan atau belum menunggu persetujuan.");
  await logAudit({ userId: actor.id, action: "letter.approve", entityType: "letter", entityId: id });
  redirectWithMessage(PATH, "ok", "Surat disetujui.");
}

export async function issueLetterAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.letterIssue);
  const id = Number(formData.get("letterId"));
  if (!Number.isInteger(id) || id <= 0) fail("ID surat tidak valid.");
  const result = await executeSql("UPDATE letters l INNER JOIN employees e ON e.id=l.employee_id SET l.status='ISSUED' WHERE l.id=? AND l.status='APPROVED' AND (? OR e.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id=?))", [id, actor.scopeAll, actor.id]);
  if (result.affectedRows !== 1) fail("Surat belum disetujui atau di luar scope.");
  await logAudit({ userId: actor.id, action: "letter.issue", entityType: "letter", entityId: id });
  redirectWithMessage(PATH, "ok", "Surat diterbitkan.");
}

export async function deleteLetterAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.letterCreate);
  const id = Number(formData.get("letterId"));
  if (!Number.isInteger(id) || id <= 0) fail("ID surat tidak valid.");

  let letter: LetterDeleteRow;
  try {
    letter = await withTransaction(async (connection) => {
      const [rows] = await connection.execute<LetterDeleteRow[]>(
        `SELECT l.file_path, l.letter_number, l.status
         FROM letters l
         INNER JOIN employees e ON e.id = l.employee_id
         WHERE l.id = ? AND (? OR e.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id = ?))
         FOR UPDATE`,
        [id, actor.scopeAll, actor.id],
      );
      const current = rows[0];
      if (!current) throw new Error("LETTER_NOT_FOUND");
      if (!["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(current.status)) {
        throw new Error("LETTER_NOT_DELETEABLE");
      }
      if (!isGeneratedLetterPath(current.file_path)) throw new Error("LETTER_FILE_INVALID");

      const [result] = await connection.execute<ResultSetHeader>(
        "DELETE FROM letters WHERE id = ? AND status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED')",
        [id],
      );
      if (result.affectedRows !== 1) throw new Error("LETTER_NOT_DELETEABLE");
      return current;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LETTER_NOT_FOUND") {
      fail("Surat tidak ditemukan atau di luar scope Anda.");
    }
    if (error instanceof Error && error.message === "LETTER_NOT_DELETEABLE") {
      fail("Surat terbit tidak dapat dihapus.");
    }
    if (error instanceof Error && error.message === "LETTER_FILE_INVALID") {
      fail("Lokasi file surat tidak valid. Hubungi administrator.");
    }
    throw error;
  }

  let fileCleanupFailed = false;
  try {
    await deleteStoredFile(`private/${letter.file_path}`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code !== "ENOENT") {
      fileCleanupFailed = true;
      console.error("[letters] generated file removal failed", {
        letterId: id,
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  await logAudit({
    userId: actor.id,
    action: "letter.delete",
    entityType: "letter",
    entityId: id,
    details: { letterNumber: letter.letter_number, previousStatus: letter.status, fileCleanupFailed },
  });
  if (fileCleanupFailed) fail("Surat terhapus, tetapi file fisiknya gagal dibersihkan. Hubungi administrator.");
  redirectWithMessage(PATH, "ok", "Surat berhasil dihapus.");
}
