"use server";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  MAX_UPLOAD_BYTES,
  putStoredFile,
  deleteStoredFile,
} from "@/core/storage/files";
import { randomUUID } from "node:crypto";
import { queryRows, withTransaction } from "@/core/db";
import { createBlindIndex, encryptField } from "@/core/crypto/field-encrypt";
import { AUDIT_ACTIONS, logAudit } from "@/core/audit/log";
import { firstIssueMessage, redirectWithMessage } from "@/core/http/navigation";
import { assertBrandAccess } from "@/core/rbac/scope";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { normalizePhone } from "@/core/normalization";
import {
  deactivateEmployeeSchema,
  employeeActivationSchema,
  employeeUpdateSchema,
} from "./schema";
import { hasSensitiveEmployeeChanges } from "./sensitive";
import { insertEmployeeRecord } from "./insert-employee";

const PATH = "/employees";
function fail(message: string): never {
  return redirectWithMessage(PATH, "error", message);
}
function done(message: string): never {
  return redirectWithMessage(PATH, "ok", message);
}

interface OrgRow extends RowDataPacket {
  brand_id: number;
  location_brand_id: number | null;
  position_id: number;
}
interface EmployeeBrandRow extends RowDataPacket {
  brand_id: number;
}

export async function createEmployeeAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.employeeCreate);
  await requireFeatureEnabled("employees");
  const returnPath =
    formData.get("returnPath") === "/employees/new" ? "/employees/new" : PATH;
  const failCreate = (message: string): never =>
    redirectWithMessage(returnPath, "error", message);
  const parsed = employeeActivationSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return failCreate(firstIssueMessage(parsed.error));
  const data = parsed.data;
  const sensitiveFieldsProvided =
    formData.has("npwp") ||
    formData.has("bankName") ||
    formData.has("bankAccountNumber");
  if (
    sensitiveFieldsProvided &&
    !actor.permissions.includes(PERMISSIONS.employeeViewSensitive)
  )
    failCreate("Anda tidak memiliki izin mengisi data sensitif.");
  const orgRows = await queryRows<OrgRow>(
    `SELECT c.brand_id, l.brand_id AS location_brand_id, p.id AS position_id
     FROM companies c CROSS JOIN positions p INNER JOIN locations l ON l.id = ?
     WHERE c.id = ? AND p.id = ? LIMIT 1`,
    [data.locationId, data.companyId, data.positionId],
  );
  const org = orgRows[0];
  if (
    !org ||
    (org.location_brand_id !== null && org.location_brand_id !== org.brand_id)
  )
    failCreate("Kombinasi CV, jabatan, dan lokasi tidak valid.");
  assertBrandAccess(actor, org.brand_id);

  const ktp = formData.get("ktpPhoto");
  let ktpPhotoPath: string | null = null;
  if (ktp instanceof File && ktp.size > 0) {
    if (
      ktp.size > MAX_UPLOAD_BYTES ||
      !["image/jpeg", "image/png"].includes(ktp.type)
    ) {
      failCreate("Foto KTP harus JPG/PNG dan maksimal 1,5 MB.");
    }
    const bytes = Buffer.from(await ktp.arrayBuffer());
    const validJpeg = bytes.subarray(0, 3).toString("hex") === "ffd8ff";
    const validPng =
      bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
    if (!validJpeg && !validPng) failCreate("Isi file foto KTP tidak valid.");
    ktpPhotoPath = `ktp/${randomUUID()}.${validPng ? "png" : "jpg"}`;
    await putStoredFile(`private/${ktpPhotoPath}`, bytes);
  }

  try {
    const employee = await withTransaction(async (connection) => {
      return insertEmployeeRecord(
        connection,
        { ...data, brandId: org.brand_id },
        ktpPhotoPath,
      );
    });
    await logAudit({
      userId: actor.id,
      action: AUDIT_ACTIONS.employeeCreate,
      entityType: "employee",
      entityId: employee.employeeId,
      details: {
        employeeCode: employee.employeeCode,
        companyId: data.companyId,
      },
    });
  } catch (error) {
    if (ktpPhotoPath)
      await deleteStoredFile(`private/${ktpPhotoPath}`).catch(() =>
        console.error("[storage] Failed to clean uncommitted upload"),
      );
    const code =
      typeof error === "object" && error !== null
        ? (error as { code?: string }).code
        : undefined;
    failCreate(
      code === "ER_DUP_ENTRY"
        ? "Kode karyawan atau NIK sudah digunakan."
        : "Gagal menyimpan karyawan.",
    );
  }
  done(
    "Karyawan aktif berhasil ditambahkan. Data yang kosong dapat dilengkapi dari profil.",
  );
}

export async function deactivateEmployeeAction(
  formData: FormData,
): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.employeeDeactivate);
  await requireFeatureEnabled("employees");
  const parsed = deactivateEmployeeSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) fail(firstIssueMessage(parsed.error));
  try {
    await withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE employees e
         SET e.is_active = FALSE, e.exit_date = ?, e.exit_reason_id = ?
         WHERE e.id = ? AND e.is_active = TRUE AND (? OR e.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id = ?))`,
        [
          parsed.data.exitDate,
          parsed.data.exitReasonId,
          parsed.data.employeeId,
          actor.scopeAll,
          actor.id,
        ],
      );
      if (result.affectedRows !== 1) throw new Error("EMPLOYEE_NOT_FOUND");
      await connection.execute("DELETE FROM employee_verifications WHERE employee_id=?", [parsed.data.employeeId]);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      fail(
        "Karyawan tidak ditemukan, sudah nonaktif, atau di luar scope Anda.",
      );
    }
    fail("Karyawan gagal dinonaktifkan.");
  }
  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.employeeDeactivate,
    entityType: "employee",
    entityId: parsed.data.employeeId,
    details: {
      exitDate: parsed.data.exitDate,
      exitReasonId: parsed.data.exitReasonId,
    },
  });
  done("Karyawan dinonaktifkan.");
}

export async function updateEmployeeAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.employeeUpdate);
  await requireFeatureEnabled("employees");
  if (!actor.permissions.includes(PERMISSIONS.employeeViewPrivateFields))
    fail("Anda tidak memiliki izin mengubah data pribadi karyawan.");
  const parsed = employeeUpdateSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) fail(firstIssueMessage(parsed.error));
  const data = parsed.data;
  const currentEmployee = (
    await queryRows<EmployeeBrandRow>(
      `SELECT e.brand_id FROM employees e
     WHERE e.id=? AND (? OR e.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id=?))
     LIMIT 1`,
      [data.employeeId, actor.scopeAll, actor.id],
    )
  )[0];
  if (!currentEmployee)
    fail("Karyawan tidak ditemukan atau di luar scope Anda.");
  let brandId = currentEmployee.brand_id;
  if (data.companyId !== null) {
    const orgRows = await queryRows<OrgRow>(
      `SELECT c.brand_id, l.brand_id AS location_brand_id, p.id AS position_id
       FROM companies c CROSS JOIN positions p INNER JOIN locations l ON l.id=?
       WHERE c.id=? AND p.id=? LIMIT 1`,
      [data.locationId, data.companyId, data.positionId],
    );
    const org = orgRows[0];
    if (
      !org ||
      (org.location_brand_id !== null && org.location_brand_id !== org.brand_id)
    )
      fail("Kombinasi CV, jabatan, dan lokasi tidak valid.");
    brandId = org.brand_id;
  } else {
    const orgRows = await queryRows<RowDataPacket>(
      "SELECT p.id AS position_id, l.brand_id AS location_brand_id FROM positions p CROSS JOIN locations l WHERE p.id=? AND l.id=? LIMIT 1",
      [data.positionId, data.locationId],
    );
    const org = orgRows[0] as
      | (RowDataPacket & {
          position_id: number;
          location_brand_id: number | null;
        })
      | undefined;
    if (
      !org ||
      (org.location_brand_id !== null && org.location_brand_id !== brandId)
    )
      fail("Kombinasi jabatan dan lokasi tidak valid untuk brand karyawan.");
  }
  assertBrandAccess(actor, brandId);
  const financialFieldsProvided =
    formData.has("npwp") ||
    formData.has("bankName") ||
    formData.has("bankAccountNumber");
  const sensitiveFieldsProvided = hasSensitiveEmployeeChanges(formData);
  if (
    sensitiveFieldsProvided &&
    !actor.permissions.includes(PERMISSIONS.employeeViewSensitive)
  )
    fail("Anda tidak memiliki izin mengubah data sensitif.");
  const ktp = formData.get("ktpPhoto");
  let ktpPhotoPath: string | undefined;
  if (ktp instanceof File && ktp.size > 0) {
    if (
      ktp.size > MAX_UPLOAD_BYTES ||
      !["image/jpeg", "image/png"].includes(ktp.type)
    )
      fail("Foto KTP harus JPG/PNG dan maksimal 1,5 MB.");
    const bytes = Buffer.from(await ktp.arrayBuffer());
    const validJpeg = bytes.subarray(0, 3).toString("hex") === "ffd8ff";
    const validPng =
      bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
    if (!validJpeg && !validPng) fail("Isi file foto KTP tidak valid.");
    ktpPhotoPath = `ktp/${randomUUID()}.${validPng ? "png" : "jpg"}`;
    await putStoredFile(`private/${ktpPhotoPath}`, bytes);
  }
  const sensitiveSet = financialFieldsProvided
    ? ", e.npwp_encrypted=?, e.bank_name=?, e.bank_account_encrypted=?"
    : "";
  const sensitiveValues = financialFieldsProvided
    ? [
        data.npwp ? encryptField(data.npwp) : null,
        data.bankName ?? null,
        data.bankAccountNumber ? encryptField(data.bankAccountNumber) : null,
      ]
    : [];
  let previousKtpPath: string | null = null;
  let result: ResultSetHeader;
  try {
    result = await withTransaction(async (connection) => {
      const [current] = await connection.execute<RowDataPacket[]>(
        "SELECT ktp_photo_path,company_id,position_id,location_id FROM employees WHERE id=? AND (? OR brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id=?)) FOR UPDATE",
        [data.employeeId, actor.scopeAll, actor.id],
      );
      if (!current[0]) throw new Error("EMPLOYEE_NOT_FOUND");
      if (current[0].company_id !== data.companyId || current[0].position_id !== data.positionId || current[0].location_id !== data.locationId) throw new Error("USE_PLACEMENT_FLOW");
      previousKtpPath = current[0].ktp_photo_path ?? null;
      const [updated] = await connection.execute<ResultSetHeader>(
        `UPDATE employees e SET e.employee_code=?, e.full_name=?, e.birth_place=?, e.birth_date=?, e.address_current=?, e.address_ktp=?, e.email=?, e.phone=?${sensitiveSet}, e.marital_status=?, e.children_count=?, e.company_id=?, e.brand_id=?, e.position_id=?, e.location_id=?, e.join_date=?${ktpPhotoPath ? ", e.ktp_photo_path=?" : ""}${data.nik ? ", e.nik_encrypted=?, e.nik_hash=?" : ""} WHERE e.id=? AND (? OR e.brand_id IN (SELECT brand_id FROM user_brand_access WHERE user_id=?))`,
        [
          data.employeeCode,
          data.fullName,
          data.birthPlace,
          data.birthDate,
          data.addressCurrent,
          data.addressKtp,
          data.email,
          data.phone ? normalizePhone(data.phone) : null,
          ...sensitiveValues,
          data.maritalStatus,
          data.childrenCount,
          data.companyId,
          brandId,
          data.positionId,
          data.locationId,
          data.joinDate,
          ...(ktpPhotoPath ? [ktpPhotoPath] : []),
          ...(data.nik
            ? [encryptField(data.nik), createBlindIndex(data.nik)]
            : []),
          data.employeeId,
          actor.scopeAll,
          actor.id,
        ],
      );
      await connection.execute("DELETE FROM employee_verifications WHERE employee_id=?", [data.employeeId]);
      return updated;
    });
  } catch (error) {
    if (ktpPhotoPath)
      await deleteStoredFile(`private/${ktpPhotoPath}`).catch(() =>
        console.error("[storage] Failed to clean uncommitted upload"),
      );
    if (error instanceof Error && error.message === "USE_PLACEMENT_FLOW") fail("Gunakan Mutasi penempatan pada detail karyawan untuk mengubah CV, jabatan, atau outlet.");
    fail(
      "Gagal memperbarui karyawan. Periksa kode dan NIK yang mungkin sudah digunakan.",
    );
  }
  if (result.affectedRows !== 1) {
    if (ktpPhotoPath)
      await deleteStoredFile(`private/${ktpPhotoPath}`).catch(() =>
        console.error("[storage] Failed to clean uncommitted upload"),
      );
    fail("Karyawan tidak ditemukan atau di luar scope Anda.");
  }
  if (ktpPhotoPath && previousKtpPath && previousKtpPath !== ktpPhotoPath) {
    await deleteStoredFile(`private/${previousKtpPath}`).catch(() =>
      console.error("[storage] Failed to clean replaced KTP"),
    );
  }
  await logAudit({
    userId: actor.id,
    action: "employee.update",
    entityType: "employee",
    entityId: data.employeeId,
    details: { employeeCode: data.employeeCode, companyId: data.companyId },
  });
  redirectWithMessage(
    `/employees/${data.employeeId}`,
    "ok",
    "Data karyawan diperbarui.",
  );
}
