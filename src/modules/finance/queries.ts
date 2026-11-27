import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import { PERMISSIONS } from "@/core/rbac/permissions";
import type { SessionUser } from "@/types/database";
import { financePeriod } from "./policy";
export const READY_SQL =
  "(e.company_id IS NOT NULL AND e.join_date IS NOT NULL AND e.nik_hash IS NOT NULL AND NULLIF(e.bank_name,'') IS NOT NULL AND NULLIF(e.bank_account_encrypted,'') IS NOT NULL)";
export interface FinanceRow extends RowDataPacket {
  id: number;
  employee_code: string;
  full_name: string;
  company_name: string | null;
  brand_name: string;
  location_name: string;
  position_name: string;
  amount: string | null;
  future_amount: string | null;
  future_date: string | null;
  employment_type: string | null;
  pending: number;
  changed: number;
  ready: number;
  verified: number;
  is_active: number;
  exit_date: string | null;
  placement_known: number;
}
export async function financeDirectory(
  user: SessionUser,
  raw: Record<string, string | string[] | undefined>,
  requestedPage = 1,
) {
  if (!user.permissions.includes(PERMISSIONS.financeView))
    throw new Error("FORBIDDEN");
  const period = financePeriod(raw.month);
  const scope = directBrandScope(user, "e.brand_id");
  const clauses = [scope.clause];
  const params = [...scope.params];
  if (raw.status !== "all") {
    clauses.push("e.is_active=?");
    params.push(raw.status === "inactive" ? 0 : 1);
  }
  for (const [key, col] of [
    ["brand", "e.brand_id"],
    ["company", "e.company_id"],
    ["location", "e.location_id"],
  ]) {
    const n = typeof raw[key] === "string" ? Number(raw[key]) : NaN;
    if (Number.isSafeInteger(n) && n > 0) {
      clauses.push(`${col}=?`);
      params.push(n);
    }
  }
  const tasks: Record<string, string> = {
    incomplete: `NOT ${READY_SQL}`,
    unverified:
      "NOT EXISTS(SELECT 1 FROM employee_verifications v WHERE v.employee_id=e.id)",
    pending:
      "EXISTS(SELECT 1 FROM salary_changes sc WHERE sc.employee_id=e.id AND sc.status='PENDING')",
  };
  if (typeof raw.task === "string" && Object.hasOwn(tasks, raw.task))
    clauses.push(tasks[raw.task]);
  const search =
    typeof raw.search === "string" ? raw.search.trim().slice(0, 80) : "";
  if (search) {
    clauses.push("(e.full_name LIKE ? OR e.employee_code LIKE ?)");
    const term = search.replace(/[\\%_]/g, "\\$&") + "%";
    params.push(term, term);
  }
  // Current organisation filters/scope are explicit. Historical placement is shown on detail.
  const where = clauses.join(" AND ");
  const [count] = await queryRows<RowDataPacket>(
    `SELECT COUNT(*) total FROM employees e WHERE ${where}`,
    params,
  );
  const total = Number(count.total);
  const page = Math.min(
    Math.max(1, requestedPage),
    Math.max(1, Math.ceil(total / 25)),
  );
  const rows = await queryRows<FinanceRow>(
    `SELECT e.id,e.employee_code,e.full_name,c.name company_name,b.name brand_name,l.name location_name,p.name position_name,e.is_active,DATE_FORMAT(e.exit_date,'%Y-%m-%d') exit_date,
 (SELECT sc.amount FROM salary_changes sc WHERE sc.employee_id=e.id AND sc.status='APPROVED' AND sc.effective_date<=? ORDER BY sc.effective_date DESC LIMIT 1) amount,
 (SELECT sc.amount FROM salary_changes sc WHERE sc.employee_id=e.id AND sc.status='APPROVED' AND sc.effective_date>? ORDER BY sc.effective_date LIMIT 1) future_amount,
 (SELECT DATE_FORMAT(sc.effective_date,'%Y-%m-%d') FROM salary_changes sc WHERE sc.employee_id=e.id AND sc.status='APPROVED' AND sc.effective_date>? ORDER BY sc.effective_date LIMIT 1) future_date,
 (SELECT CASE WHEN ty.is_permanent THEN 'Tetap' ELSE 'Tidak Tetap' END FROM contracts ct JOIN contract_types ty ON ty.id=ct.contract_type_id WHERE ct.employee_id=e.id AND ct.start_date<=? AND (ct.end_date IS NULL OR ct.end_date>=?) ORDER BY ct.start_date DESC,ct.id DESC LIMIT 1) employment_type,
 EXISTS(SELECT 1 FROM salary_changes sc WHERE sc.employee_id=e.id AND sc.status='PENDING') pending,
 EXISTS(SELECT 1 FROM salary_changes sc WHERE sc.employee_id=e.id AND sc.status='APPROVED' AND sc.effective_date BETWEEN ? AND ?) changed,
 ${READY_SQL} ready,EXISTS(SELECT 1 FROM employee_verifications v WHERE v.employee_id=e.id) verified,
 EXISTS(SELECT 1 FROM employee_placements h WHERE h.employee_id=e.id AND h.effective_date<=?) placement_known
 FROM employees e LEFT JOIN companies c ON c.id=e.company_id JOIN brands b ON b.id=e.brand_id JOIN positions p ON p.id=e.position_id JOIN locations l ON l.id=e.location_id WHERE ${where}
 ORDER BY b.name,c.name,e.full_name,e.id LIMIT ? OFFSET ?`,
    [
      period.end,
      period.end,
      period.end,
      period.end,
      period.start,
      period.start,
      period.end,
      period.end,
      ...params,
      25,
      (page - 1) * 25,
    ],
  );
  const [summary] = await queryRows<RowDataPacket>(
    `SELECT COUNT(*) total,COALESCE(SUM(NOT ${READY_SQL}),0) incomplete,
 COALESCE(SUM(EXISTS(SELECT 1 FROM salary_changes sc WHERE sc.employee_id=e.id AND sc.status='PENDING')),0) pending,
 COALESCE(SUM(EXISTS(SELECT 1 FROM salary_changes sc WHERE sc.employee_id=e.id AND sc.status='APPROVED' AND sc.effective_date BETWEEN ? AND ?)),0) changed,
 COALESCE(SUM(NOT EXISTS(SELECT 1 FROM employee_verifications v WHERE v.employee_id=e.id)),0) unverified
 FROM employees e WHERE ${where}`,
    [period.start, period.end, ...params],
  );
  return { rows, total, page, period, summary };
}
export async function financeEmployee(user: SessionUser, id: number) {
  if (!user.permissions.includes(PERMISSIONS.financeView))
    throw new Error("FORBIDDEN");
  const scope = directBrandScope(user, "e.brand_id");
  const [e] = await queryRows<RowDataPacket>(
    `SELECT e.id,e.full_name,e.employee_code,e.company_id,e.brand_id,e.position_id,e.location_id,e.is_active,DATE_FORMAT(e.join_date,'%Y-%m-%d') join_date, c.name company_name,b.name brand_name,l.name location_name,p.name position_name,${READY_SQL} ready,v.verified_at,u.name verified_by
 FROM employees e LEFT JOIN companies c ON c.id=e.company_id JOIN brands b ON b.id=e.brand_id JOIN locations l ON l.id=e.location_id JOIN positions p ON p.id=e.position_id LEFT JOIN employee_verifications v ON v.employee_id=e.id LEFT JOIN users u ON u.id=v.verified_by WHERE e.id=? AND ${scope.clause}`,
    [id, ...scope.params],
  );
  if (!e) return null;
  const [changes, placements, currentRows, futureRows] = await Promise.all([
    queryRows<RowDataPacket>(
      `SELECT s.id,s.amount,DATE_FORMAT(s.effective_date,'%Y-%m-%d') effective_date,s.reason,s.status,s.requested_by,s.requested_at,s.decision_note,a.name requester,b.name decider FROM salary_changes s JOIN users a ON a.id=s.requested_by LEFT JOIN users b ON b.id=s.decided_by WHERE s.employee_id=? ORDER BY s.effective_date DESC,s.id DESC LIMIT 100`,
      [id],
    ),
    queryRows<RowDataPacket>(
      "SELECT DATE_FORMAT(effective_date,'%Y-%m-%d') effective_date,company_name,brand_name,position_name,location_name,reason FROM employee_placements WHERE employee_id=? ORDER BY effective_date DESC,id DESC LIMIT 100",
      [id],
    ),
    queryRows<RowDataPacket>(
      "SELECT amount,DATE_FORMAT(effective_date,'%Y-%m-%d') effective_date FROM salary_changes WHERE employee_id=? AND status='APPROVED' AND effective_date<=DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+07:00')) ORDER BY effective_date DESC LIMIT 1",
      [id],
    ),
    queryRows<RowDataPacket>(
      "SELECT id,amount,DATE_FORMAT(effective_date,'%Y-%m-%d') effective_date FROM salary_changes WHERE employee_id=? AND status='APPROVED' AND effective_date>DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+07:00')) ORDER BY effective_date LIMIT 20",
      [id],
    ),
  ]);
  return {
    employee: e,
    changes,
    placements,
    current: currentRows[0],
    future: futureRows,
  };
}

export interface SalaryListRow extends RowDataPacket {
  id: number;
  employee_id: number;
  full_name: string;
  employee_code: string;
  company_name: string | null;
  brand_name: string;
  amount: string;
  effective_date: string;
  status: string;
  requester: string;
  decider: string | null;
}
export async function listSalaryChanges(
  user: SessionUser,
  mode: "requests" | "history",
  requestedPage = 1,
) {
  if (!user.permissions.includes(PERMISSIONS.financeView))
    throw new Error("FORBIDDEN");
  const scope = directBrandScope(user, "e.brand_id");
  const where = `${scope.clause} AND ${mode === "requests" ? "s.status='PENDING'" : "s.status<>'PENDING'"}`;
  const [count] = await queryRows<RowDataPacket>(
    `SELECT COUNT(*) total FROM salary_changes s JOIN employees e ON e.id=s.employee_id WHERE ${where}`,
    scope.params,
  );
  const total = Number(count.total);
  const page = Math.min(
    Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1),
    Math.max(1, Math.ceil(total / 25)),
  );
  const rows = await queryRows<SalaryListRow>(
    `SELECT s.id,s.employee_id,e.full_name,e.employee_code,c.name company_name,b.name brand_name,s.amount,DATE_FORMAT(s.effective_date,'%Y-%m-%d') effective_date,s.status,a.name requester,d.name decider FROM salary_changes s JOIN employees e ON e.id=s.employee_id LEFT JOIN companies c ON c.id=e.company_id JOIN brands b ON b.id=e.brand_id JOIN users a ON a.id=s.requested_by LEFT JOIN users d ON d.id=s.decided_by WHERE ${where} ORDER BY ${mode === "requests" ? "s.requested_at ASC,s.id ASC" : "s.decided_at DESC,s.id DESC"} LIMIT ? OFFSET ?`,
    [...scope.params, 25, (page - 1) * 25],
  );
  return { rows, total, page };
}
