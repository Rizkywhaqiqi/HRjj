"use server";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { logAudit } from "@/core/audit/log";
import { decryptField, encryptField } from "@/core/crypto/field-encrypt";
import { queryRows, withTransaction } from "@/core/db";
import { firstIssueMessage, redirectWithMessage } from "@/core/http/navigation";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { assertBrandAccess, directBrandScope } from "@/core/rbac/scope";
import { employeeActivationSchema } from "./schema";
import { insertEmployeeRecord } from "./insert-employee";

const STAGING_PATH = "/employees/staging";

interface StagingPayloadRow extends RowDataPacket {
  payload_encrypted: string;
  application_id: number | null;
  brand_id: number | null;
}

interface OrganizationMappingRow extends RowDataPacket {
  brand_id: number;
  location_brand_id: number | null;
  company_is_active: 0 | 1;
  position_is_active: 0 | 1;
  location_is_active: 0 | 1;
}

function fail(path: string, message: string): never {
  return redirectWithMessage(path, "error", message);
}

function completionPath(stagingId: number): string {
  return `${STAGING_PATH}/${stagingId}`;
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

function parsePayload(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(decryptField(value));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error("INVALID_STAGING_PAYLOAD");
  }
  return parsed as Record<string, unknown>;
}

function candidateCvPath(payload: Record<string, unknown>): string | null {
  const value = payload.__cvFilePath;
  if (typeof value !== "string" || value === "") return null;
  if (
    !value.startsWith("cv/") ||
    value.includes("..") ||
    value.includes("\\") ||
    value.startsWith("/") ||
    !value.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("CV_FILE_INVALID");
  }
  return value;
}

const progressSchema = z.object({
  stagingId: z.coerce.number().int().positive(),
  fullName: z.string().trim().min(2).max(150),
  nik: z.string().trim().max(32),
  birthPlace: z.string().trim().max(100),
  birthDate: z.string().trim().max(10),
  addressCurrent: z.string().trim().max(2000),
  addressKtp: z.string().trim().max(2000),
  email: z.string().trim().max(150),
  phone: z.string().trim().max(30),
  companyId: z.string().trim().max(12),
  positionId: z.string().trim().max(12),
  locationId: z.string().trim().max(12),
  joinDate: z.string().trim().max(10),
  maritalStatus: z.enum(["", "SINGLE", "MARRIED", "DIVORCED"]),
  childrenCount: z.string().trim().max(3),
});

export async function saveEmployeeStagingProgressAction(
  formData: FormData,
): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.employeeCreate);
  await requireFeatureEnabled("employees");

  const stagingIdResult = z.coerce.number().int().positive().safeParse(
    formData.get("stagingId"),
  );
  if (!stagingIdResult.success) {
    fail(STAGING_PATH, "Data staging tidak valid.");
  }
  const path = completionPath(stagingIdResult.data);
  const parsed = progressSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    fail(path, firstIssueMessage(parsed.error));
  }

  const { stagingId, ...completion } = parsed.data;
  const scope = directBrandScope(actor, "s.brand_id");
  try {
    await withTransaction(async (connection) => {
      const [rows] = await connection.execute<StagingPayloadRow[]>(
        `SELECT s.payload_encrypted, s.application_id, s.brand_id
         FROM employee_import_staging s
         WHERE s.id = ? AND s.status = 'PENDING'
           AND s.application_id IS NOT NULL AND ${scope.clause}
           AND EXISTS (
             SELECT 1 FROM applications a
             WHERE a.id = s.application_id AND a.stage = 'ACCEPTED'
           )
         FOR UPDATE`,
        [stagingId, ...scope.params],
      );
      const row = rows[0];
      if (!row) throw new Error("STAGING_NOT_PENDING");

      const payload = parsePayload(row.payload_encrypted);
      payload.__completion = completion;
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE employee_import_staging
         SET full_name = ?, payload_encrypted = ?
         WHERE id = ? AND status = 'PENDING'`,
        [
          completion.fullName,
          encryptField(JSON.stringify(payload)),
          stagingId,
        ],
      );
      if (result.affectedRows !== 1) throw new Error("STAGING_NOT_PENDING");
    });
  } catch (error) {
    const errorCode = getErrorCode(error);
    await logAudit({
      userId: actor.id,
      action: "employee.staging.progress.failed",
      entityType: "employee_import_staging",
      entityId: stagingId,
      details: { errorCode: errorCode ?? "UNKNOWN" },
    });
    fail(
      path,
      error instanceof Error && error.message === "STAGING_NOT_PENDING"
        ? "Data staging tidak ditemukan atau sudah diproses."
        : "Progres gagal disimpan. Silakan coba lagi.",
    );
  }

  await logAudit({
    userId: actor.id,
    action: "employee.staging.progress",
    entityType: "employee_import_staging",
    entityId: stagingId,
  });
  redirectWithMessage(path, "ok", "Progres data berhasil disimpan.");
}

export async function promoteEmployeeStagingAction(
  formData: FormData,
): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.employeeCreate);
  await requireFeatureEnabled("employees");

  const stagingIdResult = z.coerce.number().int().positive().safeParse(
    formData.get("stagingId"),
  );
  if (!stagingIdResult.success) {
    fail(STAGING_PATH, "Data staging tidak valid.");
  }
  const stagingId = stagingIdResult.data;
  const path = completionPath(stagingId);
  const parsed = employeeActivationSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    fail(path, `Periksa data wajib dan penempatan kerja. ${firstIssueMessage(parsed.error)}`);
  }

  const data = parsed.data;
  const scope = directBrandScope(actor, "s.brand_id");
  const organizationRows = await queryRows<OrganizationMappingRow>(
    `SELECT c.brand_id, c.is_active AS company_is_active,
            p.is_active AS position_is_active,
            l.brand_id AS location_brand_id, l.is_active AS location_is_active
     FROM companies c
     CROSS JOIN positions p
     INNER JOIN locations l ON l.id = ?
     WHERE c.id = ? AND p.id = ?
     LIMIT 1`,
    [data.locationId, data.companyId, data.positionId],
  );
  const organization = organizationRows[0];
  if (
    !organization ||
    organization.company_is_active !== 1 ||
    organization.position_is_active !== 1 ||
    (organization.location_is_active !== 1 &&
      organization.location_brand_id !== null) ||
    (organization.location_brand_id !== null &&
      organization.location_brand_id !== organization.brand_id)
  ) {
    fail(path, "Kombinasi CV, jabatan, dan lokasi tidak valid atau tidak aktif.");
  }
  assertBrandAccess(actor, organization.brand_id);

  const completion = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value === null || value === undefined ? "" : String(value),
    ]),
  );

  let createdEmployee: { employeeId: number; employeeCode: string };
  try {
    createdEmployee = await withTransaction(async (connection) => {
      const [stagingRows] = await connection.execute<StagingPayloadRow[]>(
        `SELECT s.payload_encrypted, s.application_id, s.brand_id
         FROM employee_import_staging s
         WHERE s.id = ? AND s.status = 'PENDING'
           AND s.application_id IS NOT NULL AND ${scope.clause}
           AND EXISTS (
             SELECT 1 FROM applications a
             WHERE a.id = s.application_id AND a.stage = 'ACCEPTED'
           )
         FOR UPDATE`,
        [stagingId, ...scope.params],
      );
      const stagingRow = stagingRows[0];
      if (!stagingRow) throw new Error("STAGING_NOT_PENDING");
      if (stagingRow.brand_id !== null && stagingRow.brand_id !== organization.brand_id) {
        throw new Error("STAGING_BRAND_MISMATCH");
      }

      const payload = parsePayload(stagingRow.payload_encrypted);
      const cvFilePath = candidateCvPath(payload);

      if (organization.location_is_active !== 1) {
        const [locationResult] = await connection.execute<ResultSetHeader>(
          `UPDATE locations SET is_active = TRUE
           WHERE id = ? AND brand_id IS NULL AND is_active = FALSE`,
          [data.locationId],
        );
        if (locationResult.affectedRows !== 1) {
          throw new Error("LOCATION_CHANGED");
        }
      }

      const employee = await insertEmployeeRecord(connection, { ...data, brandId: organization.brand_id }, null, {
        applicationId: stagingRow.application_id ?? undefined,
        cvFilePath,
      });
      payload.__completion = completion;

      if (stagingRow.application_id !== null) {
        const [applicationResult] = await connection.execute<ResultSetHeader>(
          "UPDATE applications SET stage = 'HIRED' WHERE id = ? AND stage = 'ACCEPTED'",
          [stagingRow.application_id],
        );
        if (applicationResult.affectedRows !== 1) {
          throw new Error("APPLICATION_NOT_ACCEPTED");
        }
      }

      const [stagingResult] = await connection.execute<ResultSetHeader>(
        `UPDATE employee_import_staging
         SET full_name = ?, payload_encrypted = ?, status = 'PROMOTED',
             employee_id = ?, brand_id = ?
         WHERE id = ? AND status = 'PENDING'`,
        [
          data.fullName,
          encryptField(JSON.stringify(payload)),
          employee.employeeId,
          organization.brand_id,
          stagingId,
        ],
      );
      if (stagingResult.affectedRows !== 1) {
        throw new Error("STAGING_NOT_PENDING");
      }
      return employee;
    });
  } catch (error) {
    const errorCode = getErrorCode(error);
    await logAudit({
      userId: actor.id,
      action: "employee.staging.promote.failed",
      entityType: "employee_import_staging",
      entityId: stagingId,
      details: { errorCode: errorCode ?? "UNKNOWN" },
    });

    if (errorCode === "ER_DUP_ENTRY") {
      fail(path, "Kode karyawan atau NIK sudah digunakan.");
    }
    if (error instanceof Error && error.message === "STAGING_NOT_PENDING") {
      fail(path, "Data staging tidak ditemukan atau sudah diproses.");
    }
    if (error instanceof Error && error.message === "LOCATION_CHANGED") {
      fail(path, "Lokasi berubah; muat ulang halaman dan pilih lokasi aktif.");
    }
    if (error instanceof Error && error.message === "STAGING_BRAND_MISMATCH") {
      fail(path, "Data ini harus tetap berada di brand asal kandidat.");
    }
    if (error instanceof Error && error.message === "APPLICATION_NOT_ACCEPTED") {
      fail(path, "Kandidat tidak lagi berstatus diterima.");
    }
    fail(path, "Karyawan gagal dibuat. Periksa kembali data dan pemetaannya.");
  }

  await logAudit({
    userId: actor.id,
    action: "employee.create",
    entityType: "employee",
    entityId: createdEmployee.employeeId,
    details: {
      employeeCode: createdEmployee.employeeCode,
      companyId: data.companyId,
    },
  });
  await logAudit({
    userId: actor.id,
    action: "employee.staging.promote",
    entityType: "employee_import_staging",
    entityId: stagingId,
    details: { employeeId: createdEmployee.employeeId },
  });
  redirectWithMessage(
    "/employees",
    "ok",
    "Karyawan berhasil diaktifkan. Data yang belum lengkap dapat dilengkapi dari profilnya.",
  );
}
