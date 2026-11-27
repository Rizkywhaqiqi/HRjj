"use server";

import { nextContractDate } from "./date";
import { assertNoContractOverlap } from "./overlap";
import { contractExitDate } from "./policy";
import { todayInJakarta } from "@/modules/letters/date";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { queryRows, withTransaction } from "@/core/db";
import { logAudit } from "@/core/audit/log";
import { firstIssueMessage, redirectWithMessage } from "@/core/http/navigation";
import { assertBrandAccess } from "@/core/rbac/scope";
import {
  isFeatureEnabled,
  requireFeatureEnabled,
  requirePermission,
} from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { contractCreateSchema, contractDecisionSchema } from "./schema";

const PATH = "/contracts";
function fail(message: string, path = PATH): never {
  return redirectWithMessage(path, "error", message);
}
function done(message: string): never {
  return redirectWithMessage(PATH, "ok", message);
}
interface EmployeeContractRow extends RowDataPacket {
  employee_id: number;
  company_id: number | null;
  brand_id: number;
  is_active: 0 | 1;
}
interface ContractTypeRow extends RowDataPacket {
  id: number;
  is_permanent: 0 | 1;
}

export async function createContractAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.contractCreate);
  await requireFeatureEnabled("contracts");
  const continueToLetter = formData.get("continueToLetter") === "1";
  if (continueToLetter) {
    await requirePermission(PERMISSIONS.letterView);
    await requirePermission(PERMISSIONS.letterCreate);
    await requireFeatureEnabled("letters");
  }
  const employeeId = Number(formData.get("employeeId"));
  const employeePath =
    Number.isSafeInteger(employeeId) && employeeId > 0
      ? `${PATH}?employeeId=${employeeId}`
      : PATH;
  const parsed = contractCreateSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) fail(firstIssueMessage(parsed.error), employeePath);
  const data = parsed.data;
  if (data.endDate && data.endDate < data.startDate)
    fail(
      "Tanggal akhir kontrak tidak boleh sebelum tanggal mulai.",
      employeePath,
    );
  const employeeRows = await queryRows<EmployeeContractRow>(
    `SELECT e.id AS employee_id, e.company_id, e.brand_id, e.is_active FROM employees e WHERE e.id = ? LIMIT 1`,
    [data.employeeId],
  );
  const employee = employeeRows[0];
  if (!employee || !employee.is_active)
    fail("Karyawan tidak ditemukan atau sudah nonaktif.", employeePath);
  assertBrandAccess(actor, employee.brand_id);
  if (employee.company_id === null)
    fail(
      "Pilih CV pada profil karyawan sebelum membuat kontrak.",
      employeePath,
    );
  const contractType = (
    await queryRows<ContractTypeRow>(
      "SELECT id, is_permanent FROM contract_types WHERE id=? AND is_active=TRUE LIMIT 1",
      [data.contractTypeId],
    )
  )[0];
  if (!contractType)
    fail("Jenis kontrak tidak aktif atau tidak ditemukan.", employeePath);
  if (contractType.is_permanent === 1 && data.endDate)
    fail("Kontrak tetap tidak boleh memiliki tanggal akhir.", employeePath);
  if (contractType.is_permanent === 0 && !data.endDate)
    fail("Kontrak PKWT wajib memiliki tanggal akhir.", employeePath);
  let id: number;
  try {
    id = await withTransaction(async (connection) => {
      const [locked] = await connection.execute<EmployeeContractRow[]>(
        "SELECT id employee_id,company_id,brand_id,is_active FROM employees WHERE id=? FOR UPDATE",
        [data.employeeId],
      );
      if (
        !locked[0]?.is_active ||
        locked[0].company_id !== employee.company_id ||
        locked[0].brand_id !== employee.brand_id
      )
        throw new Error(
          "Data karyawan berubah. Muat ulang sebelum membuat kontrak.",
        );
      assertBrandAccess(actor, locked[0].brand_id);
      await assertNoContractOverlap(
        connection,
        data.employeeId,
        data.startDate,
        data.endDate,
      );
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO contracts (employee_id, contract_type_id, start_date, end_date, base_salary) VALUES (?, ?, ?, ?, ?)`,
        [
          data.employeeId,
          data.contractTypeId,
          data.startDate,
          data.endDate,
          data.baseSalary,
        ],
      );
      return result.insertId;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CONTRACT_OVERLAP")
      fail("Kontrak aktif karyawan masih tumpang tindih.", employeePath);
    fail(
      error instanceof Error && !("code" in error)
        ? error.message
        : "Gagal menyimpan kontrak.",
      employeePath,
    );
  }
  await logAudit({
    userId: actor.id,
    action: "contract.create",
    entityType: "contract",
    entityId: id,
    details: { employeeId: data.employeeId },
  });
  if (continueToLetter) {
    const params = new URLSearchParams({
      employeeId: String(data.employeeId),
      contractId: String(id),
      type: "CONTRACT",
      flow: "new-contract",
    });
    redirectWithMessage(
      `/letters?${params}`,
      "ok",
      "Kontrak berhasil dibuat. Lengkapi surat kontraknya.",
    );
  }
  done("Kontrak berhasil dibuat.");
}

export async function decideContractAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.contractDecide);
  await requireFeatureEnabled("contracts");
  const parsed = contractDecisionSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) fail(firstIssueMessage(parsed.error));
  const data = parsed.data;
  let nextId: number | null = null;
  let nextEmployeeId = 0;
  try {
    nextId = await withTransaction(async (connection) => {
      // Same lock order as creation and letter renewal: employee, then contracts.
      const [employeeRefs] = await connection.execute<RowDataPacket[]>(
        "SELECT employee_id FROM contracts WHERE id=?",
        [data.contractId],
      );
      if (!employeeRefs[0]) throw new Error("CONTRACT_NOT_FOUND");
      await connection.execute(
        "SELECT id FROM employees WHERE id=? FOR UPDATE",
        [employeeRefs[0].employee_id],
      );
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT ct.id, ct.employee_id, DATE_FORMAT(ct.end_date, '%Y-%m-%d') AS end_date, ct.base_salary, e.is_active, c.brand_id FROM contracts ct INNER JOIN employees e ON e.id = ct.employee_id INNER JOIN companies c ON c.id = e.company_id WHERE ct.id = ? AND ct.status = 'RUNNING' FOR UPDATE`,
        [data.contractId],
      );
      const contract = rows[0] as
        | (RowDataPacket & {
            employee_id: number;
            end_date: string | null;
            base_salary: string | null;
            is_active: 0 | 1;
            brand_id: number;
          })
        | undefined;
      if (!contract || !contract.is_active)
        throw new Error("CONTRACT_NOT_FOUND");
      assertBrandAccess(actor, contract.brand_id);
      nextEmployeeId = contract.employee_id;
      if (data.decision === "EXTEND") {
        if (
          !contract.end_date ||
          !data.newStartDate ||
          !data.newEndDate ||
          data.newStartDate !== nextContractDate(contract.end_date) ||
          data.newEndDate < data.newStartDate
        )
          throw new Error("CONTRACT_DATE_INVALID");
        const [typeRows] = await connection.execute<ContractTypeRow[]>(
          "SELECT id, is_permanent FROM contract_types WHERE id=? AND is_active=TRUE LIMIT 1",
          [data.newContractTypeId],
        );
        if (!typeRows[0]) throw new Error("CONTRACT_TYPE_NOT_FOUND");
        if (typeRows[0].is_permanent === 1)
          throw new Error("CONTRACT_TYPE_PERMANENT");
        await assertNoContractOverlap(
          connection,
          contract.employee_id,
          data.newStartDate,
          data.newEndDate,
          data.contractId,
        );
        await connection.execute(
          "UPDATE contracts SET status = 'EXTENDED' WHERE id = ?",
          [data.contractId],
        );
        const [created] = await connection.execute<ResultSetHeader>(
          "INSERT INTO contracts (employee_id, contract_type_id, previous_contract_id, start_date, end_date, base_salary, status) VALUES (?, ?, ?, ?, ?, ?, 'RUNNING')",
          [
            contract.employee_id,
            data.newContractTypeId,
            data.contractId,
            data.newStartDate,
            data.newEndDate,
            contract.base_salary,
          ],
        );
        return created.insertId;
      } else if (data.decision === "PERMANENT") {
        if (!contract.end_date)
          throw new Error("Kontrak ini sudah tanpa tanggal akhir.");
        const startDate = nextContractDate(contract.end_date);
        await assertNoContractOverlap(
          connection,
          contract.employee_id,
          startDate,
          null,
          data.contractId,
        );
        await connection.execute(
          "UPDATE contracts SET status = 'MADE_PERMANENT' WHERE id = ?",
          [data.contractId],
        );
        const [types] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM contract_types WHERE is_permanent = TRUE AND is_active = TRUE LIMIT 1",
        );
        if (!types[0]) throw new Error("PERMANENT_TYPE_NOT_FOUND");
        const [created] = await connection.execute<ResultSetHeader>(
          "INSERT INTO contracts (employee_id, contract_type_id, previous_contract_id, start_date, end_date, base_salary, status) VALUES (?, ?, ?, ?, NULL, ?, 'RUNNING')",
          [
            contract.employee_id,
            types[0].id,
            data.contractId,
            startDate,
            contract.base_salary,
          ],
        );
        return created.insertId;
      } else {
        const exitDate = contractExitDate(contract.end_date, todayInJakarta());
        const [future] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM contracts WHERE employee_id=? AND id<>? AND status='RUNNING' AND (end_date IS NULL OR end_date>=?) LIMIT 1 FOR UPDATE",
          [contract.employee_id, data.contractId, todayInJakarta()],
        );
        if (future[0])
          throw new Error(
            "Karyawan sudah memiliki kontrak berikutnya. Periksa kontrak tersebut sebelum menonaktifkan.",
          );
        if (!data.exitReasonId) throw new Error("EXIT_REASON_REQUIRED");
        const [exitReasons] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM exit_reasons WHERE id = ? AND is_active = TRUE LIMIT 1 FOR UPDATE",
          [data.exitReasonId],
        );
        if (!exitReasons[0]) throw new Error("EXIT_REASON_INVALID");
        await connection.execute(
          "UPDATE contracts SET status = 'NOT_EXTENDED' WHERE id = ?",
          [data.contractId],
        );
        await connection.execute(
          "UPDATE employees SET is_active = FALSE, exit_date = ?, exit_reason_id = ? WHERE id = ?",
          [exitDate, data.exitReasonId, contract.employee_id],
        );
        await connection.execute("DELETE FROM employee_verifications WHERE employee_id=?", [contract.employee_id]);
      }
      return null;
    });
  } catch (error) {
    fail(
      error instanceof Error && error.message === "CONTRACT_NOT_FOUND"
        ? "Kontrak tidak ditemukan atau sudah diputuskan."
        : error instanceof Error && error.message === "CONTRACT_DATE_INVALID"
          ? "Kontrak baru harus dimulai sehari setelah kontrak lama dan tanggal akhirnya valid."
          : error instanceof Error &&
              error.message === "CONTRACT_TYPE_NOT_FOUND"
            ? "Jenis kontrak baru tidak aktif."
            : error instanceof Error &&
                error.message === "CONTRACT_TYPE_PERMANENT"
              ? "Perpanjangan harus menggunakan jenis kontrak berjangka."
              : error instanceof Error &&
                  error.message === "EXIT_REASON_INVALID"
                ? "Alasan keluar tidak aktif atau tidak ditemukan."
                : error instanceof Error && !("code" in error)
                  ? error.message
                  : "Keputusan kontrak gagal diproses.",
    );
  }
  await logAudit({
    userId: actor.id,
    action: "contract.decision",
    entityType: "contract",
    entityId: data.contractId,
    details: {
      decision: data.decision,
      exitReasonId: data.decision === "NOT_EXTEND" ? data.exitReasonId : null,
    },
  });
  if (
    nextId &&
    actor.permissions.includes(PERMISSIONS.letterView) &&
    actor.permissions.includes(PERMISSIONS.letterCreate) &&
    (await isFeatureEnabled("letters"))
  ) {
    redirectWithMessage(
      `/letters?employeeId=${nextEmployeeId}&contractId=${nextId}&type=CONTRACT`,
      "ok",
      "Kontrak berikutnya tersimpan. Lengkapi surat kontraknya.",
    );
  }
  done("Keputusan kontrak berhasil disimpan.");
}
