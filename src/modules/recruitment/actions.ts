"use server";

import path from "node:path";
import { redirect } from "next/navigation";
import { deleteStoredFile, MAX_UPLOAD_BYTES, putStoredFile } from "@/core/storage/files";
import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { executeSql, queryRows, withTransaction } from "@/core/db";
import { hashPassword, verifyPassword } from "@/core/auth/password";
import { createCandidateSession, destroyCandidateSession, requireCandidateSession } from "@/core/auth/candidate-session";
import { consumeRateLimit, rateLimitKey } from "@/core/auth/rate-limit";
import { firstIssueMessage } from "@/core/http/navigation";
import { createBlindIndex, decryptField, encryptField } from "@/core/crypto/field-encrypt";
import { getClientIp, logAudit } from "@/core/audit/log";
import { assertBrandAccess } from "@/core/rbac/scope";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { normalizePhone } from "@/core/normalization";
import { candidateLoginSchema, candidateRegisterSchema, applicationSchema, applicationDecisionSchema, candidateProfileSchema, withdrawConsentSchema, candidateAnonymizeSchema } from "./schema";
import { vacancyCreateSchema, vacancyStatusSchema } from "./schema";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

function error(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }
const CANDIDATE_LOGIN_WINDOW_SECONDS = 15 * 60;
let dummyCandidatePasswordHash: Promise<string> | undefined;

function getDummyCandidatePasswordHash(): Promise<string> {
  dummyCandidatePasswordHash ??= hashPassword(randomUUID());
  return dummyCandidatePasswordHash;
}

interface AccountRow extends RowDataPacket { id: number; password_hash: string; session_version: number; is_active: 0 | 1; }
interface CandidateApplyRow extends RowDataPacket { id: number; nik_hash: string | null; birth_place: string | null; birth_date: string | null; address_current: string | null; cv_file_path: string | null; }
interface VacancyOrgRow extends RowDataPacket { company_brand_id: number; location_brand_id: number | null; }
interface AcceptedApplicationDraftRow extends RowDataPacket {
  stage: string;
  cv_snapshot_path: string | null;
  agreed_join_date: string | null;
  company_id: number;
  position_id: number;
  location_id: number;
  brand_id: number;
  company_is_active: 0 | 1;
  position_is_active: 0 | 1;
  location_is_active: 0 | 1;
  location_brand_id: number | null;
  candidate_active: 0 | 1;
  full_name: string;
  email: string;
  phone: string;
  nik_encrypted: string | null;
  birth_place: string | null;
  birth_date: string | null;
  address_current: string | null;
  cv_file_path: string | null;
  position_name: string;
  location_name: string;
}

export async function registerCandidateAction(formData: FormData): Promise<void> {
  const parsed = candidateRegisterSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) error("/kandidat/register", firstIssueMessage(parsed.error));
  const data = parsed.data;
  const ip = getClientIp(await headers());
  const [ipLimit, emailLimit] = await Promise.all([
    consumeRateLimit({
      key: rateLimitKey("candidate:register:ip", ip ?? "unknown"),
      limit: 10,
      windowSeconds: 3600,
    }),
    consumeRateLimit({
      key: rateLimitKey("candidate:register:email", data.email),
      limit: 5,
      windowSeconds: 3600,
    }),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    await logAudit({
      userId: null,
      action: "auth.candidate.register.rate_limited",
      entityType: "candidate_auth",
      details: { reason: "rate_limited" },
      ipAddress: ip,
    });
    error("/kandidat/register", "Pendaftaran terlalu sering. Coba lagi nanti.");
  }
  try {
    const accountId = await withTransaction(async (connection) => {
      const phone = normalizePhone(data.phone);
      const [result] = await connection.execute<ResultSetHeader>("INSERT INTO candidate_accounts (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)", [data.fullName, data.email, phone, await hashPassword(data.password)]);
      await connection.execute("INSERT INTO candidates (account_id, full_name, email, phone) VALUES (?, ?, ?, ?)", [result.insertId, data.fullName, data.email, phone]);
      return result.insertId;
    });
    await createCandidateSession(accountId, 0);
  } catch (err) {
    const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
    error("/kandidat/register", code === "ER_DUP_ENTRY" ? "Email atau nomor telepon sudah terdaftar." : "Registrasi gagal.");
  }
  redirect("/kandidat");
}

export async function loginCandidateAction(formData: FormData): Promise<void> {
  const parsed = candidateLoginSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) error("/kandidat/login", "Email atau password tidak valid.");
  const ip = getClientIp(await headers());
  const [ipLimit, emailLimit] = await Promise.all([
    consumeRateLimit({
      key: rateLimitKey("candidate:login:ip", ip ?? "unknown"),
      limit: 10,
      windowSeconds: CANDIDATE_LOGIN_WINDOW_SECONDS,
    }),
    consumeRateLimit({
      key: rateLimitKey("candidate:login:email", parsed.data.email),
      limit: 5,
      windowSeconds: CANDIDATE_LOGIN_WINDOW_SECONDS,
    }),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    await logAudit({
      userId: null,
      action: "auth.candidate.login.failed",
      entityType: "candidate_auth",
      details: { reason: "rate_limited" },
      ipAddress: ip,
    });
    error("/kandidat/login", "Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.");
  }
  const rows = await queryRows<AccountRow>("SELECT id, password_hash, session_version, is_active FROM candidate_accounts WHERE email = ? LIMIT 1", [parsed.data.email]);
  const account = rows[0];
  const passwordMatches = await verifyPassword(
    parsed.data.password,
    account?.password_hash ?? (await getDummyCandidatePasswordHash()),
  );
  if (!account || !passwordMatches || !account.is_active) {
    await logAudit({
      userId: null,
      action: "auth.candidate.login.failed",
      entityType: "candidate_auth",
      details: { reason: !account ? "unknown_email" : !account.is_active ? "inactive" : "bad_password" },
      ipAddress: ip,
    });
    error("/kandidat/login", "Email atau password salah.");
  }
  await createCandidateSession(account.id, account.session_version);
  await logAudit({
    userId: null,
    action: "auth.candidate.login.success",
    entityType: "candidate_auth",
    details: { accountId: account.id },
    ipAddress: ip,
  });
  redirect("/kandidat");
}

export async function logoutCandidateAction(): Promise<void> { await destroyCandidateSession(); redirect("/kandidat/login"); }

export async function applyToVacancyAction(formData: FormData): Promise<void> {
  const candidate = await requireCandidateSession();
  const parsed = applicationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) error("/karir", firstIssueMessage(parsed.error));
  const candidateRows = await queryRows<CandidateApplyRow>("SELECT id, nik_hash, birth_place, birth_date, address_current, cv_file_path FROM candidates WHERE account_id = ? LIMIT 1", [candidate.accountId]);
  const profile = candidateRows[0];
  if (!profile) error("/kandidat", "Profil kandidat belum tersedia.");
  if (!profile.nik_hash || !profile.birth_place || !profile.birth_date || !profile.address_current || !profile.cv_file_path) error("/kandidat/profile", "Lengkapi profil dan upload CV sebelum melamar.");
  try {
    const result = await executeSql(`INSERT INTO applications (vacancy_id, candidate_id, cv_snapshot_path, consent_given, consent_at, consent_policy_version) SELECT v.id, ?, ?, TRUE, NOW(), '2026-01' FROM vacancies v WHERE v.id = ? AND v.status = 'OPEN'`, [profile.id, profile.cv_file_path, parsed.data.vacancyId]);
    if (result.affectedRows !== 1) error("/karir", "Lowongan tidak tersedia.");
  } catch (err) {
    const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
    error("/karir", code === "ER_DUP_ENTRY" ? "Anda sudah melamar lowongan ini." : "Lamaran gagal dikirim.");
  }
  redirect("/kandidat?ok=Lamaran berhasil dikirim.");
}

export async function withdrawApplicationConsentAction(formData: FormData): Promise<void> {
  const candidate = await requireCandidateSession();
  const parsed = withdrawConsentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) error("/kandidat", "Lamaran tidak valid.");
  const result = await executeSql(`UPDATE applications a INNER JOIN candidates c ON c.id=a.candidate_id SET a.consent_withdrawn_at=NOW() WHERE a.id=? AND c.account_id=? AND a.consent_withdrawn_at IS NULL AND a.stage <> 'HIRED'`, [parsed.data.applicationId, candidate.accountId]);
  if (result.affectedRows !== 1) error("/kandidat", "Persetujuan sudah ditarik atau lamaran tidak dapat diubah.");
  redirect("/kandidat?ok=Penarikan persetujuan dicatat.");
}

export async function anonymizeCandidateAccountAction(formData: FormData): Promise<void> {
  const candidate = await requireCandidateSession();
  const parsed = candidateAnonymizeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) error("/kandidat", "Konfirmasi anonimisasi wajib diberikan.");
  const anonymizedName = `Kandidat dianonimkan #${candidate.accountId}`;
  const anonymizedEmail = `anonymized-${candidate.accountId}@invalid.local`;
  const anonymizedPhone = `anonymized-${candidate.accountId}`;
  try {
    const removedCvPath = await withTransaction(async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>("SELECT c.cv_file_path, EXISTS(SELECT 1 FROM applications a WHERE a.candidate_id=c.id AND a.stage='HIRED') AS has_hired FROM candidates c WHERE c.account_id=? FOR UPDATE", [candidate.accountId]);
      const row = rows[0] as (RowDataPacket & { cv_file_path: string | null; has_hired: 0 | 1 }) | undefined;
      if (!row) throw new Error("CANDIDATE_NOT_FOUND");
      if (row.has_hired === 1) throw new Error("CANDIDATE_RETAINED");
      const cvPath = row.cv_file_path;
      await connection.execute("UPDATE applications a INNER JOIN candidates c ON c.id=a.candidate_id SET a.consent_withdrawn_at=COALESCE(a.consent_withdrawn_at, NOW()) WHERE c.account_id=?", [candidate.accountId]);
      await connection.execute("UPDATE candidates SET full_name=?, email=?, phone=?, nik_encrypted=NULL, nik_hash=NULL, birth_place=NULL, birth_date=NULL, address_current=NULL, last_education=NULL, cv_file_path=NULL, portfolio_url=NULL, notes=NULL WHERE account_id=?", [anonymizedName, anonymizedEmail, anonymizedPhone, candidate.accountId]);
      await connection.execute("UPDATE candidate_accounts SET full_name=?, email=?, phone=?, is_active=FALSE, session_version=session_version+1 WHERE id=?", [anonymizedName, anonymizedEmail, anonymizedPhone, candidate.accountId]);
      return cvPath;
    });
    if (removedCvPath && removedCvPath.startsWith("cv/") && !removedCvPath.includes("..")) await deleteStoredFile(`private/${removedCvPath}`).catch(() => undefined);
  } catch (err) {
    if (err instanceof Error && err.message === "CANDIDATE_RETAINED") error("/kandidat", "Akun yang sudah menjadi karyawan harus dipertahankan sesuai kebijakan retensi.");
    error("/kandidat", "Anonimisasi akun gagal.");
  }
  await logAudit({ userId: null, action: "candidate.anonymize", entityType: "candidate_account", entityId: candidate.accountId, details: { retainedApplicationHistory: true } });
  redirect("/kandidat/login?ok=Akun berhasil dianonimkan.");
}

export async function updateCandidateProfileAction(formData: FormData): Promise<void> {
  const candidate = await requireCandidateSession();
  const parsed = candidateProfileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) error("/kandidat/profile", firstIssueMessage(parsed.error));
  const data = parsed.data;
  const cv = formData.get("cv");
  let cvPath: string | undefined;
  if (cv instanceof File && cv.size > 0) {
    if (cv.size > MAX_UPLOAD_BYTES || cv.type !== "application/pdf") error("/kandidat/profile", "CV harus PDF dan maksimal 4 MB.");
    const bytes = Buffer.from(await cv.arrayBuffer());
    if (bytes.subarray(0, 4).toString("ascii") !== "%PDF") error("/kandidat/profile", "Isi file CV bukan PDF yang valid.");
    const name = `${randomUUID()}.pdf`;
    cvPath = `cv/${name}`;
    await putStoredFile(`private/${cvPath}`, bytes);
  }
  try {
    await withTransaction(async (connection) => {
      const phone = normalizePhone(data.phone);
      await connection.execute(
        `UPDATE candidate_accounts SET full_name=?, phone=? WHERE id=? AND is_active=TRUE`,
        [data.fullName, phone, candidate.accountId],
      );
      await connection.execute(
        `UPDATE candidates SET full_name=?, email=(SELECT email FROM candidate_accounts WHERE id=?), phone=?, nik_encrypted=?, nik_hash=?, birth_place=?, birth_date=?, address_current=?, last_education=?${cvPath ? ", cv_file_path=?" : ""} WHERE account_id=?`,
        [data.fullName, candidate.accountId, phone, encryptField(data.nik), createBlindIndex(data.nik), data.birthPlace, data.birthDate, data.addressCurrent, data.lastEducation, ...(cvPath ? [cvPath] : []), candidate.accountId],
      );
    });
  } catch (err) {
    const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
    error("/kandidat/profile", code === "ER_DUP_ENTRY" ? "Nomor telepon sudah digunakan." : "Profil kandidat gagal diperbarui.");
  }
  redirect("/kandidat?ok=Profil kandidat diperbarui.");
}

export async function decideApplicationAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.recruitmentManage);
  const parsed = applicationDecisionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) error("/recruitment", firstIssueMessage(parsed.error));

  try {
    await withTransaction(async (connection) => {
      const [rows] = await connection.execute<
        (RowDataPacket & { stage: string; brand_id: number })[]
      >(
        `SELECT a.stage, c.brand_id
         FROM applications a
         INNER JOIN vacancies v ON v.id = a.vacancy_id
         INNER JOIN companies c ON c.id = v.company_id
         WHERE a.id = ?
         FOR UPDATE`,
        [parsed.data.applicationId],
      );
      const application = rows[0];
      if (!application) throw new Error("APPLICATION_NOT_FOUND");
      assertBrandAccess(actor, application.brand_id);
      if (["ACCEPTED", "REJECTED", "HIRED"].includes(application.stage)) {
        throw new Error("APPLICATION_ALREADY_DECIDED");
      }

      const accepted = parsed.data.decision === "ACCEPTED";
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE applications
         SET stage = ?, acceptance_reason = ?, rejection_reason = ?
         WHERE id = ? AND stage NOT IN ('ACCEPTED', 'REJECTED', 'HIRED')`,
        [
          parsed.data.decision,
          accepted ? parsed.data.reason : null,
          accepted ? null : parsed.data.reason,
          parsed.data.applicationId,
        ],
      );
      if (result.affectedRows !== 1) throw new Error("APPLICATION_ALREADY_DECIDED");
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    error(
      "/recruitment",
      message === "APPLICATION_NOT_FOUND"
        ? "Lamaran tidak ditemukan atau di luar scope."
        : message === "APPLICATION_ALREADY_DECIDED"
          ? "Lamaran ini sudah memiliki keputusan."
          : "Keputusan kandidat gagal disimpan.",
    );
  }

  await logAudit({
    userId: actor.id,
    action: "recruitment.application.decision",
    entityType: "application",
    entityId: parsed.data.applicationId,
    details: { decision: parsed.data.decision },
  });
  redirect(
    `/recruitment?ok=${encodeURIComponent(
      parsed.data.decision === "ACCEPTED" ? "Kandidat diterima." : "Kandidat ditolak.",
    )}`,
  );
}

export async function createCandidateEmployeeDraftAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.recruitmentHire);
  await requirePermission(PERMISSIONS.employeeCreate);
  await requireFeatureEnabled("recruitment");
  await requireFeatureEnabled("employees");

  const applicationId = Number(formData.get("applicationId"));
  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
    error("/recruitment", "Lamaran kandidat tidak valid.");
  }

  let stagingId: number;
  try {
    stagingId = await withTransaction(async (connection) => {
      const [rows] = await connection.execute<AcceptedApplicationDraftRow[]>(
        `SELECT a.stage, a.cv_snapshot_path,
                DATE_FORMAT(a.agreed_join_date, '%Y-%m-%d') AS agreed_join_date,
                v.company_id, v.position_id, v.location_id,
                c.brand_id, c.is_active AS company_is_active,
                p.is_active AS position_is_active, p.name AS position_name,
                l.is_active AS location_is_active, l.brand_id AS location_brand_id,
                l.name AS location_name, ca.is_active AS candidate_active,
                ca.full_name, ca.email, ca.phone, cd.nik_encrypted,
                DATE_FORMAT(cd.birth_date, '%Y-%m-%d') AS birth_date,
                cd.birth_place, cd.address_current, cd.cv_file_path
         FROM applications a
         INNER JOIN vacancies v ON v.id = a.vacancy_id
         INNER JOIN companies c ON c.id = v.company_id
         INNER JOIN positions p ON p.id = v.position_id
         INNER JOIN locations l ON l.id = v.location_id
         INNER JOIN candidates cd ON cd.id = a.candidate_id
         INNER JOIN candidate_accounts ca ON ca.id = cd.account_id
         WHERE a.id = ?
         FOR UPDATE`,
        [applicationId],
      );
      const application = rows[0];
      if (!application) throw new Error("APPLICATION_NOT_FOUND");
      assertBrandAccess(actor, application.brand_id);
      if (application.stage !== "ACCEPTED") throw new Error("APPLICATION_NOT_ACCEPTED");
      if (
        application.candidate_active !== 1 ||
        application.company_is_active !== 1 ||
        application.position_is_active !== 1 ||
        application.location_is_active !== 1 ||
        (application.location_brand_id !== null &&
          application.location_brand_id !== application.brand_id)
      ) {
        throw new Error("ORGANIZATION_INVALID");
      }

      const [employeeRows] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM employees WHERE application_id = ? LIMIT 1",
        [applicationId],
      );
      if (employeeRows[0]) throw new Error("APPLICATION_ALREADY_HIRED");

      const [draftRows] = await connection.execute<(RowDataPacket & { id: number })[]>(
        `SELECT id
         FROM employee_import_staging
         WHERE application_id = ? AND status = 'PENDING'
         LIMIT 1
         FOR UPDATE`,
        [applicationId],
      );
      if (draftRows[0]) return draftRows[0].id;

      const cvFilePath = application.cv_snapshot_path ?? application.cv_file_path;
      if (
        cvFilePath &&
        (!cvFilePath.startsWith("cv/") ||
          cvFilePath.includes("..") ||
          cvFilePath.includes("\\") ||
          path.isAbsolute(cvFilePath) ||
          !cvFilePath.toLowerCase().endsWith(".pdf"))
      ) {
        throw new Error("CV_FILE_INVALID");
      }

      const nik = application.nik_encrypted
        ? decryptField(application.nik_encrypted)
        : "";
      const birthDetails = [
        application.birth_place ?? "",
        application.birth_date ?? "",
      ].filter(Boolean).join(", ");
      const completion = {
        fullName: application.full_name,
        nik,
        birthPlace: application.birth_place ?? "",
        birthDate: application.birth_date ?? "",
        addressCurrent: application.address_current ?? "",
        addressKtp: "",
        email: application.email,
        phone: application.phone,
        companyId: String(application.company_id),
        positionId: String(application.position_id),
        locationId: String(application.location_id),
        joinDate: application.agreed_join_date ?? "",
        maritalStatus: "",
        childrenCount: "",
      };
      const payload = {
        NIK: nik,
        "Tempat, Tanggal Lahir": birthDetails,
        "Alamat Tinggal Saat ini?": application.address_current ?? "",
        "Alamat Sesuai KTP?": "",
        "Email?": application.email,
        "Nomor Handphone": application.phone,
        "Tanggal Mulai Bergabung di Perusahaan?": application.agreed_join_date ?? "",
        "Status": "",
        "Jika sudah menikah, sudah mempunyai berapa anak?": "",
        "Posisi?": application.position_name,
        "Penempatan Kerja?": application.location_name,
        __completion: completion,
        __cvFilePath: cvFilePath ?? "",
      };
      const flags = ["CANDIDATE_DATA"];
      if (!nik) flags.push("NIK_MISSING");
      const sourceSha256 = createHash("sha256")
        .update(`candidate-application:${applicationId}`)
        .digest("hex");
      const [insert] = await connection.execute<ResultSetHeader>(
        `INSERT INTO employee_import_staging
          (source_sha256, source_row_number, application_id, brand_id,
           full_name, payload_encrypted, review_flags)
         VALUES (?, 1, ?, ?, ?, ?, ?)`,
        [
          sourceSha256,
          applicationId,
          application.brand_id,
          application.full_name,
          encryptField(JSON.stringify(payload)),
          JSON.stringify(flags),
        ],
      );
      return insert.insertId;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    error(
      "/recruitment",
      message === "APPLICATION_NOT_FOUND"
        ? "Lamaran tidak ditemukan atau di luar scope."
        : message === "APPLICATION_NOT_ACCEPTED"
          ? "Kandidat harus diterima sebelum dibuatkan data karyawan."
          : message === "APPLICATION_ALREADY_HIRED"
            ? "Kandidat ini sudah tercatat sebagai karyawan."
            : message === "ORGANIZATION_INVALID"
              ? "CV, jabatan, atau lokasi lowongan sudah tidak aktif atau tidak sesuai."
              : message === "CV_FILE_INVALID"
                ? "File CV kandidat tidak valid."
                : "Draft karyawan gagal dibuat.",
    );
  }

  await logAudit({
    userId: actor.id,
    action: "employee.staging.candidate.create",
    entityType: "employee_import_staging",
    entityId: stagingId,
    details: { applicationId },
  });
  redirect(
    `/employees/staging/${stagingId}?ok=${encodeURIComponent("Data kandidat siap dilengkapi.")}`,
  );
}

function slugify(value: string): string { return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 170); }
export async function createVacancyAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.vacancyManage); const parsed = vacancyCreateSchema.safeParse(Object.fromEntries(formData.entries())); if (!parsed.success) error("/recruitment/vacancies", firstIssueMessage(parsed.error)); const data = parsed.data; const rows = await queryRows<VacancyOrgRow>(`SELECT c.brand_id AS company_brand_id, l.brand_id AS location_brand_id FROM companies c INNER JOIN locations l ON l.id=? INNER JOIN positions p ON p.id=? WHERE c.id=? LIMIT 1`, [data.locationId, data.positionId, data.companyId]); const org = rows[0]; if (!org || (org.location_brand_id !== null && org.location_brand_id !== org.company_brand_id)) error("/recruitment/vacancies", "Kombinasi organisasi lowongan tidak valid."); assertBrandAccess(actor, org.company_brand_id); const slug = `${slugify(data.title)}-${Date.now().toString(36)}`; try { await executeSql(`INSERT INTO vacancies (company_id, position_id, location_id, title, slug, description, requirements, quota, status, published_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', NULL, ?)`, [data.companyId, data.positionId, data.locationId, data.title, slug, data.description, data.requirements, data.quota, actor.id]); } catch { error("/recruitment/vacancies", "Lowongan gagal dibuat."); } redirect("/recruitment/vacancies?ok=Lowongan dibuat sebagai draft.");
}
export async function updateVacancyStatusAction(formData: FormData): Promise<void> { const actor = await requirePermission(PERMISSIONS.vacancyManage); const parsed = vacancyStatusSchema.safeParse(Object.fromEntries(formData.entries())); if (!parsed.success) error("/recruitment/vacancies", firstIssueMessage(parsed.error)); const result = await executeSql(`UPDATE vacancies v INNER JOIN companies c ON c.id=v.company_id SET v.status=?, v.published_at=IF(?='OPEN', COALESCE(v.published_at, NOW()), v.published_at), v.closed_at=IF(?='CLOSED', CURDATE(), NULL) WHERE v.id=? AND (? OR c.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id=?))`, [parsed.data.status, parsed.data.status, parsed.data.status, parsed.data.vacancyId, actor.scopeAll, actor.id]); if (result.affectedRows !== 1) error("/recruitment/vacancies", "Lowongan tidak ditemukan atau di luar scope."); redirect("/recruitment/vacancies?ok=Status lowongan diperbarui."); }
