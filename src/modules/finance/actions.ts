"use server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { z } from "zod";
import { withTransaction } from "@/core/db";
import { requirePermission, requireFeatureEnabled } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { directBrandScope, assertBrandAccess } from "@/core/rbac/scope";
import { redirectWithMessage } from "@/core/http/navigation";
import { logAudit, AUDIT_ACTIONS } from "@/core/audit/log";
import {
  salaryRequestSchema,
  salaryDecisionSchema,
  assertSalaryDecision,
  jakartaToday,
} from "./policy";
import { recordPlacement } from "./placement";
import { READY_SQL } from "./queries";
import type { SessionUser } from "@/types/database";
async function lockEmployee(
  conn: import("mysql2/promise").PoolConnection,
  actor: SessionUser,
  id: number,
) {
  const scope = directBrandScope(actor, "e.brand_id");
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT e.id,e.company_id,e.brand_id,e.position_id,e.location_id,e.is_active,DATE_FORMAT(e.join_date,'%Y-%m-%d') join_date,${READY_SQL} ready FROM employees e WHERE e.id=? AND ${scope.clause} FOR UPDATE`,
    [id, ...scope.params],
  );
  if (!rows[0])
    throw new Error("Karyawan tidak ditemukan atau di luar akses Anda.");
  return rows[0];
}
function message(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "ER_DUP_ENTRY")
    return "Sudah ada gaji disetujui pada tanggal tersebut. Periksa riwayat.";
  return error instanceof Error && !code
    ? error.message
    : "Penyimpanan gagal. Muat ulang lalu coba lagi.";
}
export async function requestSalaryAction(form: FormData) {
  const actor = await requirePermission(PERMISSIONS.financeManage);
  await requirePermission(PERMISSIONS.financeView);
  await requireFeatureEnabled("employees");
  const parsed = salaryRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    redirectWithMessage("/finance", "error", parsed.error.issues[0].message);
  const d = parsed.data;
  const path = `/finance/employees/${d.employeeId}`;
  try {
    await withTransaction(async (conn) => {
      const e = await lockEmployee(conn, actor, d.employeeId);
      if (!e.is_active)
        throw new Error("Perubahan gaji hanya untuk karyawan aktif.");
      if (!e.join_date || d.effectiveDate < e.join_date)
        throw new Error(
          "Lengkapi tanggal masuk. Tanggal berlaku tidak boleh sebelum tanggal masuk.",
        );
      const [existing] = await conn.execute<RowDataPacket[]>(
        "SELECT id FROM salary_changes WHERE employee_id=? AND effective_date=? AND status IN ('PENDING','APPROVED') LIMIT 1",
        [d.employeeId, d.effectiveDate],
      );
      if (existing.length)
        throw new Error(
          "Sudah ada pengajuan atau gaji disetujui pada tanggal tersebut.",
        );
      await conn.execute(
        "INSERT INTO salary_changes(employee_id,amount,effective_date,reason,requested_by) VALUES (?,?,?,?,?)",
        [d.employeeId, d.amount, d.effectiveDate, d.reason, actor.id],
      );
    });
  } catch (e) {
    redirectWithMessage(path, "error", message(e));
  }
  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.salaryRequest,
    entityType: "employee",
    entityId: d.employeeId,
    details: { effectiveDate: d.effectiveDate },
  });
  redirectWithMessage(
    path,
    "ok",
    "Pengajuan tersimpan. Menunggu keputusan pengguna lain yang berwenang.",
  );
}
export async function decideSalaryAction(form: FormData) {
  const actor = await requirePermission(PERMISSIONS.financeView);
  await requireFeatureEnabled("employees");
  const parsed = salaryDecisionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    redirectWithMessage(
      "/finance",
      "error",
      "Keputusan dan catatan wajib valid.",
    );
  const d = parsed.data;
  await requirePermission(
    d.decision === "CANCELLED"
      ? PERMISSIONS.financeManage
      : PERMISSIONS.financeApprove,
  );
  let employeeId = 0;
  try {
    await withTransaction(async (conn) => {
      // Discover immutable employee ID, then take locks in the same order as requests/transfers.
      const [refs] = await conn.execute<RowDataPacket[]>(
        "SELECT employee_id FROM salary_changes WHERE id=?",
        [d.id],
      );
      if (!refs[0]) throw new Error("Pengajuan tidak ditemukan.");
      employeeId = Number(refs[0].employee_id);
      const employee = await lockEmployee(conn, actor, employeeId);
      const [rows] = await conn.execute<RowDataPacket[]>(
        "SELECT status,requested_by,DATE_FORMAT(effective_date,'%Y-%m-%d') effective_date FROM salary_changes WHERE id=? FOR UPDATE",
        [d.id],
      );
      assertSalaryDecision(
        rows[0] as { status: string; requested_by: number },
        actor.id,
        d.decision,
      );
      if (
        d.decision === "APPROVED" &&
        (!employee.is_active ||
          !employee.join_date ||
          rows[0].effective_date < employee.join_date)
      )
        throw new Error(
          "Periksa status aktif dan tanggal masuk sebelum menyetujui.",
        );
      const [r] = await conn.execute<ResultSetHeader>(
        "UPDATE salary_changes SET status=?,decided_by=?,decided_at=UTC_TIMESTAMP(),decision_note=? WHERE id=? AND status='PENDING'",
        [d.decision, actor.id, d.note, d.id],
      );
      if (r.affectedRows !== 1) throw new Error("Pengajuan sudah diproses.");
    });
  } catch (e) {
    redirectWithMessage("/finance", "error", message(e));
  }
  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.salaryDecision,
    entityType: "employee",
    entityId: employeeId,
    details: { requestId: d.id, decision: d.decision },
  });
  redirectWithMessage(
    `/finance/employees/${employeeId}`,
    "ok",
    "Keputusan tercatat. Gaji dipilih otomatis sesuai tanggal berlaku.",
  );
}
export async function verifyEmployeeAction(form: FormData) {
  const actor = await requirePermission(PERMISSIONS.employeeVerify);
  await requirePermission(PERMISSIONS.financeView);
  await requireFeatureEnabled("employees");
  const parsed = z
    .object({
      employeeId: z.coerce.number().int().positive(),
      note: z.string().trim().min(5).max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    redirectWithMessage(
      "/finance",
      "error",
      "Pilih karyawan dan isi catatan pemeriksaan.",
    );
  const d = parsed.data;
  try {
    await withTransaction(async (conn) => {
      const e = await lockEmployee(conn, actor, d.employeeId);
      if (!e.ready)
        throw new Error(
          "Lengkapi CV, tanggal masuk, NIK, bank, dan rekening terlebih dahulu.",
        );
      await conn.execute(
        "INSERT INTO employee_verifications(employee_id,verified_by,note) VALUES (?,?,?) ON DUPLICATE KEY UPDATE verified_by=VALUES(verified_by),note=VALUES(note),verified_at=UTC_TIMESTAMP()",
        [d.employeeId, actor.id, d.note],
      );
    });
  } catch (e) {
    redirectWithMessage(
      `/finance/employees/${d.employeeId}`,
      "error",
      message(e),
    );
  }
  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.employeeVerify,
    entityType: "employee",
    entityId: d.employeeId,
  });
  redirectWithMessage(
    `/finance/employees/${d.employeeId}`,
    "ok",
    "Kelengkapan administrasi telah diverifikasi; bukan persetujuan payroll.",
  );
}
export async function transferEmployeeAction(form: FormData) {
  const actor = await requirePermission(PERMISSIONS.employeeUpdate);
  await requirePermission(PERMISSIONS.employeeViewPrivateFields);
  await requireFeatureEnabled("employees");
  const parsed = z
    .object({
      employeeId: z.coerce.number().int().positive(),
      companyId: z.coerce.number().int().positive(),
      positionId: z.coerce.number().int().positive(),
      locationId: z.coerce.number().int().positive(),
      effectiveDate: z.string().date(),
      reason: z.string().trim().min(10).max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    redirectWithMessage(
      "/employees",
      "error",
      "Lengkapi tujuan penempatan, tanggal, dan alasan minimal 10 karakter.",
    );
  const d = parsed.data;
  const path = `/employees/${d.employeeId}`;
  if (d.effectiveDate !== jakartaToday())
    redirectWithMessage(
      path,
      "error",
      "Mutasi profil saat ini berlaku hari ini. Riwayat sebelum pencatatan tidak direka ulang.",
    );
  try {
    await withTransaction(async (conn) => {
      const e = await lockEmployee(conn, actor, d.employeeId);
      const [org] = await conn.execute<RowDataPacket[]>(
        "SELECT c.brand_id FROM companies c JOIN locations l ON l.id=? AND l.is_active=1 AND (l.brand_id IS NULL OR l.brand_id=c.brand_id) JOIN positions p ON p.id=? AND p.is_active=1 WHERE c.id=? AND c.is_active=1",
        [d.locationId, d.positionId, d.companyId],
      );
      if (!org[0]) throw new Error("CV, outlet, atau jabatan tidak valid.");
      assertBrandAccess(actor, Number(org[0].brand_id));
      if (!e.is_active) throw new Error("Mutasi hanya untuk karyawan aktif.");
      if (
        e.company_id === d.companyId &&
        e.position_id === d.positionId &&
        e.location_id === d.locationId
      )
        throw new Error("Tidak ada perubahan penempatan.");
      await recordPlacement(
        conn,
        d.employeeId,
        actor.id,
        "Sebelum mutasi: " + d.reason,
      );
      await conn.execute(
        "UPDATE employees SET company_id=?,brand_id=?,position_id=?,location_id=? WHERE id=?",
        [
          d.companyId,
          org[0].brand_id,
          d.positionId,
          d.locationId,
          d.employeeId,
        ],
      );
      await recordPlacement(conn, d.employeeId, actor.id, d.reason);
      await conn.execute(
        "DELETE FROM employee_verifications WHERE employee_id=?",
        [d.employeeId],
      );
    });
  } catch (e) {
    redirectWithMessage(path, "error", message(e));
  }
  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.employeePlacement,
    entityType: "employee",
    entityId: d.employeeId,
    details: { companyId: d.companyId, effectiveDate: d.effectiveDate },
  });
  redirectWithMessage(
    path,
    "ok",
    "Mutasi tercatat dan berlaku hari ini. Periksa kembali kelengkapan data.",
  );
}
