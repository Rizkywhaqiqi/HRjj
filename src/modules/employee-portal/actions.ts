"use server";

import { redirect } from "next/navigation";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { queryRows, withTransaction } from "@/core/db";
import { logAudit } from "@/core/audit/log";
import { verifyPassword } from "@/core/auth/password";
import { createEmployeeSession, destroyEmployeeSession, requireEmployeeSession } from "@/core/auth/employee-session";
import { firstIssueMessage } from "@/core/http/navigation";
import { employeePortalLoginSchema, selfLeaveSchema } from "./schema";

interface LoginRow extends RowDataPacket { account_id: number; password_hash: string; session_version: number; is_active: 0 | 1; }
function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }

export async function loginEmployeePortalAction(formData: FormData): Promise<void> { const parsed = employeePortalLoginSchema.safeParse(Object.fromEntries(formData.entries())); if (!parsed.success) fail("/self-service/login", "Kode, email, atau password tidak valid."); const rows = await queryRows<LoginRow>(`SELECT ea.id AS account_id, ea.password_hash, ea.session_version, ea.is_active FROM employee_accounts ea INNER JOIN employees e ON e.id=ea.employee_id WHERE e.employee_code=? AND ea.email=? AND e.is_active=TRUE LIMIT 1`, [parsed.data.employeeCode, parsed.data.email]); const row = rows[0]; if (!row || row.is_active !== 1 || !(await verifyPassword(parsed.data.password, row.password_hash))) fail("/self-service/login", "Kode, email, atau password salah."); await createEmployeeSession(row.account_id, row.session_version); redirect("/self-service"); }
export async function logoutEmployeePortalAction(): Promise<void> { await destroyEmployeeSession(); redirect("/self-service/login"); }

export async function createSelfLeaveAction(formData: FormData): Promise<void> {
  const employee = await requireEmployeeSession();
  const parsed = selfLeaveSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) fail("/self-service", firstIssueMessage(parsed.error));
  try {
    const requestId = await withTransaction(async (connection) => {
      const [typeRows] = await connection.execute<RowDataPacket[]>("SELECT id FROM leave_types WHERE id=? AND is_active=TRUE LIMIT 1", [parsed.data.leaveTypeId]);
      if (!typeRows[0]) throw new Error("LEAVE_TYPE_INVALID");
      const [overlap] = await connection.execute<RowDataPacket[]>("SELECT id FROM leave_requests WHERE employee_id=? AND status IN ('PENDING','APPROVED') AND start_date <= ? AND end_date >= ? LIMIT 1 FOR UPDATE", [employee.employeeId, parsed.data.endDate, parsed.data.startDate]);
      if (overlap[0]) throw new Error("LEAVE_OVERLAP");
      const [result] = await connection.execute<ResultSetHeader>("INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)", [employee.employeeId, parsed.data.leaveTypeId, parsed.data.startDate, parsed.data.endDate, parsed.data.reason ?? null]);
      return result.insertId;
    });
    await logAudit({ userId: null, action: "employee_portal.leave.create", entityType: "leave_request", entityId: requestId, details: { employeeId: employee.employeeId } });
  } catch (error) {
    if (error instanceof Error && error.message === "LEAVE_TYPE_INVALID") fail("/self-service", "Jenis cuti tidak tersedia.");
    if (error instanceof Error && error.message === "LEAVE_OVERLAP") fail("/self-service", "Tanggal cuti bertumpang tindih dengan pengajuan aktif.");
    fail("/self-service", "Pengajuan cuti gagal.");
  }
  redirect("/self-service?ok=Pengajuan cuti dikirim.");
}
