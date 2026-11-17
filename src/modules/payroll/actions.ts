"use server";
import { executeSql, withTransaction } from "@/core/db";
import type { RowDataPacket } from "mysql2/promise";
import { logAudit } from "@/core/audit/log";
import { firstIssueMessage, redirectWithMessage } from "@/core/http/navigation";
import { assertBrandAccess } from "@/core/rbac/scope";
import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { payrollSchema } from "./schema";
interface EmployeeBrand extends RowDataPacket { brand_id: number; }
export async function upsertPayrollAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.payrollManage);
  const parsed = payrollSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirectWithMessage("/payroll", "error", firstIssueMessage(parsed.error));
  const data = parsed.data;
  try {
    await withTransaction(async (connection) => {
      const [employees] = await connection.execute<EmployeeBrand[]>(
        "SELECT brand_id FROM employees WHERE id=? AND is_active=TRUE FOR UPDATE",
        [data.employeeId],
      );
      if (!employees[0]) throw new Error("EMPLOYEE_NOT_FOUND");
      assertBrandAccess(actor, employees[0].brand_id);
      // A locking read sees the latest committed status and blocks finalization
      // until this write commits. The employee lock also serializes new records.
      const [existing] = await connection.execute<RowDataPacket[]>(
        "SELECT status FROM payroll_records WHERE employee_id=? AND period_month=CONCAT(?,'-01') FOR UPDATE",
        [data.employeeId, data.periodMonth],
      );
      if (existing[0]?.status === "FINAL") throw new Error("PAYROLL_FINAL");
      const net = data.baseSalary - data.bpjsHealth - data.bpjsEmployment - data.otherDeductions;
      await connection.execute(
        `INSERT INTO payroll_records (employee_id, period_month, base_salary, bpjs_health, bpjs_employment, other_deductions, net_amount, notes, created_by)
         VALUES (?, CONCAT(?, '-01'), ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE base_salary=VALUES(base_salary), bpjs_health=VALUES(bpjs_health), bpjs_employment=VALUES(bpjs_employment), other_deductions=VALUES(other_deductions), net_amount=VALUES(net_amount), notes=VALUES(notes)`,
        [data.employeeId, data.periodMonth, data.baseSalary, data.bpjsHealth, data.bpjsEmployment, data.otherDeductions, net, data.notes ?? null, actor.id],
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYROLL_FINAL") redirectWithMessage("/payroll", "error", "Payroll final tidak dapat diubah.");
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") redirectWithMessage("/payroll", "error", "Karyawan aktif tidak ditemukan.");
    throw error;
  }
  await logAudit({ userId: actor.id, action: "payroll.upsert", entityType: "payroll_record", details: { employeeId: data.employeeId, periodMonth: data.periodMonth } });
  redirectWithMessage("/payroll", "ok", "Rekap payroll disimpan.");
}
export async function finalizePayrollAction(formData: FormData): Promise<void> { const actor = await requirePermission(PERMISSIONS.payrollManage); const payrollId = Number(formData.get("payrollId")); if (!Number.isInteger(payrollId) || payrollId <= 0) redirectWithMessage("/payroll", "error", "ID payroll tidak valid."); const result = await executeSql("UPDATE payroll_records p INNER JOIN employees e ON e.id=p.employee_id SET p.status='FINAL' WHERE p.id=? AND p.status='DRAFT' AND (? OR e.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id=?))", [payrollId, actor.scopeAll, actor.id]); if (result.affectedRows !== 1) redirectWithMessage("/payroll", "error", "Payroll tidak ditemukan, sudah final, atau di luar scope."); await logAudit({ userId: actor.id, action: "payroll.finalize", entityType: "payroll_record", entityId: payrollId }); redirectWithMessage("/payroll", "ok", "Payroll difinalisasi."); }
