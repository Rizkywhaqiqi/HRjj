"use server";

import { executeSql, withTransaction } from "@/core/db";
import { AUDIT_ACTIONS, logAudit } from "@/core/audit/log";
import { firstIssueMessage, redirectWithMessage } from "@/core/http/navigation";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { requirePermission } from "@/core/rbac/guard";
import {
  brandCreateSchema,
  brandUpdateSchema,
  companyCreateSchema,
  companyUpdateSchema,
  contractTypeCreateSchema,
  contractTypeUpdateSchema,
  divisionCreateSchema,
  divisionUpdateSchema,
  entityIdSchema,
  exitReasonCreateSchema,
  exitReasonUpdateSchema,
  locationCreateSchema,
  locationUpdateSchema,
  positionCreateSchema,
  positionUpdateSchema,
} from "./schema";
import {
  brandExists,
  brandUsageCount,
  companyUsageCount,
  contractTypeUsageCount,
  divisionExists,
  divisionUsageCount,
  exitReasonUsageCount,
  locationUsageCount,
  positionUsageCount,
} from "./queries";

const BASE = "/master-data";

function fail(path: string, message: string): never {
  return redirectWithMessage(path, "error", message);
}

function done(path: string, message: string): never {
  return redirectWithMessage(path, "ok", message);
}

interface DatabaseError {
  code?: string;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null
    ? (error as DatabaseError).code
    : undefined;
}

function duplicateMessage(error: unknown, fallback: string): string {
  return errorCode(error) === "ER_DUP_ENTRY" ? fallback : "Gagal menyimpan data.";
}

function referenceMessage(error: unknown, fallback: string): string {
  const code = errorCode(error);
  return code === "ER_ROW_IS_REFERENCED_2" || code === "ER_ROW_IS_REFERENCED"
    ? fallback
    : "Terjadi kesalahan saat memproses data.";
}

/* ---------------------------------- Brand --------------------------------- */

export async function createBrandAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = brandCreateSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  try {
    const result = await executeSql(
      "INSERT INTO brands (code, name, description) VALUES (?, ?, ?)",
      [parsed.data.code, parsed.data.name, parsed.data.description],
    );

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataCreate,
      entityType: "brand",
      entityId: result.insertId,
      details: { code: parsed.data.code, name: parsed.data.name },
    });
  } catch (error) {
    fail(BASE, duplicateMessage(error, "Kode atau nama brand sudah digunakan."));
  }

  done(BASE, "Brand berhasil ditambahkan.");
}

export async function updateBrandAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = brandUpdateSchema.safeParse({
    id: formData.get("id"),
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  try {
    await executeSql(
      "UPDATE brands SET code = ?, name = ?, description = ? WHERE id = ?",
      [parsed.data.code, parsed.data.name, parsed.data.description, parsed.data.id],
    );

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataUpdate,
      entityType: "brand",
      entityId: parsed.data.id,
      details: { code: parsed.data.code, name: parsed.data.name },
    });
  } catch (error) {
    fail(BASE, duplicateMessage(error, "Kode atau nama brand sudah digunakan."));
  }

  done(BASE, "Brand berhasil diperbarui.");
}

/* -------------------------------- Company -------------------------------- */

export async function createCompanyAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = companyCreateSchema.safeParse({
    brandId: formData.get("brandId"),
    name: formData.get("name"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    npwp: formData.get("npwp"),
    nib: formData.get("nib"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  if (!(await brandExists(parsed.data.brandId))) {
    fail(BASE, "Brand yang dipilih tidak ditemukan.");
  }

  try {
    const result = await executeSql(
      `INSERT INTO companies (brand_id, name, address, phone, email, npwp, nib)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        parsed.data.brandId,
        parsed.data.name,
        parsed.data.address,
        parsed.data.phone,
        parsed.data.email,
        parsed.data.npwp,
        parsed.data.nib,
      ],
    );

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataCreate,
      entityType: "company",
      entityId: result.insertId,
      details: { name: parsed.data.name, brandId: parsed.data.brandId },
    });
  } catch (error) {
    fail(BASE, duplicateMessage(error, "Nama CV sudah digunakan."));
  }

  done(BASE, "CV berhasil ditambahkan.");
}

export async function updateCompanyAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = companyUpdateSchema.safeParse({
    id: formData.get("id"),
    brandId: formData.get("brandId"),
    name: formData.get("name"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    npwp: formData.get("npwp"),
    nib: formData.get("nib"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  if (!(await brandExists(parsed.data.brandId))) {
    fail(BASE, "Brand yang dipilih tidak ditemukan.");
  }

  try {
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE companies
         SET brand_id = ?, name = ?, address = ?, phone = ?, email = ?, npwp = ?, nib = ?
         WHERE id = ?`,
        [
          parsed.data.brandId,
          parsed.data.name,
          parsed.data.address,
          parsed.data.phone,
          parsed.data.email,
          parsed.data.npwp,
          parsed.data.nib,
          parsed.data.id,
        ],
      );
      await connection.execute(
        "UPDATE employees SET brand_id = ? WHERE company_id = ?",
        [parsed.data.brandId, parsed.data.id],
      );
    });

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataUpdate,
      entityType: "company",
      entityId: parsed.data.id,
      details: { name: parsed.data.name, brandId: parsed.data.brandId },
    });
  } catch (error) {
    fail(BASE, duplicateMessage(error, "Nama CV sudah digunakan."));
  }

  done(BASE, "CV berhasil diperbarui.");
}

/* -------------------------------- Division -------------------------------- */

export async function createDivisionAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = divisionCreateSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  try {
    const result = await executeSql("INSERT INTO divisions (name) VALUES (?)", [
      parsed.data.name,
    ]);

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataCreate,
      entityType: "division",
      entityId: result.insertId,
      details: { name: parsed.data.name },
    });
  } catch (error) {
    fail(BASE, duplicateMessage(error, "Nama divisi sudah digunakan."));
  }

  done(BASE, "Divisi berhasil ditambahkan.");
}

export async function updateDivisionAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = divisionUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  try {
    await executeSql("UPDATE divisions SET name = ? WHERE id = ?", [
      parsed.data.name,
      parsed.data.id,
    ]);

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataUpdate,
      entityType: "division",
      entityId: parsed.data.id,
      details: { name: parsed.data.name },
    });
  } catch (error) {
    fail(BASE, duplicateMessage(error, "Nama divisi sudah digunakan."));
  }

  done(BASE, "Divisi berhasil diperbarui.");
}

/* -------------------------------- Position -------------------------------- */

export async function createPositionAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = positionCreateSchema.safeParse({
    divisionId: formData.get("divisionId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  if (!(await divisionExists(parsed.data.divisionId))) {
    fail(BASE, "Divisi yang dipilih tidak ditemukan.");
  }

  try {
    const result = await executeSql(
      "INSERT INTO positions (division_id, name) VALUES (?, ?)",
      [parsed.data.divisionId, parsed.data.name],
    );

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataCreate,
      entityType: "position",
      entityId: result.insertId,
      details: { name: parsed.data.name, divisionId: parsed.data.divisionId },
    });
  } catch (error) {
    fail(
      BASE,
      duplicateMessage(error, "Jabatan dengan nama tersebut sudah ada di divisi ini."),
    );
  }

  done(BASE, "Jabatan berhasil ditambahkan.");
}

export async function updatePositionAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = positionUpdateSchema.safeParse({
    id: formData.get("id"),
    divisionId: formData.get("divisionId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  if (!(await divisionExists(parsed.data.divisionId))) {
    fail(BASE, "Divisi yang dipilih tidak ditemukan.");
  }

  try {
    await executeSql("UPDATE positions SET division_id = ?, name = ? WHERE id = ?", [
      parsed.data.divisionId,
      parsed.data.name,
      parsed.data.id,
    ]);

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataUpdate,
      entityType: "position",
      entityId: parsed.data.id,
      details: { name: parsed.data.name, divisionId: parsed.data.divisionId },
    });
  } catch (error) {
    fail(
      BASE,
      duplicateMessage(error, "Jabatan dengan nama tersebut sudah ada di divisi ini."),
    );
  }

  done(BASE, "Jabatan berhasil diperbarui.");
}

/* -------------------------------- Location -------------------------------- */

export async function createLocationAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = locationCreateSchema.safeParse({
    brandId: formData.get("brandId"),
    name: formData.get("name"),
    city: formData.get("city"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  if (parsed.data.brandId !== null && !(await brandExists(parsed.data.brandId))) {
    fail(BASE, "Brand yang dipilih tidak ditemukan.");
  }

  try {
    const result = await executeSql(
      "INSERT INTO locations (brand_id, name, city, address) VALUES (?, ?, ?, ?)",
      [parsed.data.brandId, parsed.data.name, parsed.data.city, parsed.data.address],
    );

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataCreate,
      entityType: "location",
      entityId: result.insertId,
      details: { name: parsed.data.name, brandId: parsed.data.brandId },
    });
  } catch (error) {
    fail(BASE, duplicateMessage(error, "Nama lokasi sudah digunakan."));
  }

  done(BASE, "Lokasi berhasil ditambahkan.");
}

export async function updateLocationAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = locationUpdateSchema.safeParse({
    id: formData.get("id"),
    brandId: formData.get("brandId"),
    name: formData.get("name"),
    city: formData.get("city"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  if (parsed.data.brandId !== null && !(await brandExists(parsed.data.brandId))) {
    fail(BASE, "Brand yang dipilih tidak ditemukan.");
  }

  try {
    await executeSql(
      "UPDATE locations SET brand_id = ?, name = ?, city = ?, address = ? WHERE id = ?",
      [
        parsed.data.brandId,
        parsed.data.name,
        parsed.data.city,
        parsed.data.address,
        parsed.data.id,
      ],
    );

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataUpdate,
      entityType: "location",
      entityId: parsed.data.id,
      details: { name: parsed.data.name, brandId: parsed.data.brandId },
    });
  } catch (error) {
    fail(BASE, duplicateMessage(error, "Nama lokasi sudah digunakan."));
  }

  done(BASE, "Lokasi berhasil diperbarui.");
}

/* ------------------------------- Exit reason ------------------------------- */

export async function createExitReasonAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = exitReasonCreateSchema.safeParse({
    name: formData.get("name"),
    severity: formData.get("severity"),
    rehirable: formData.get("rehirable"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  try {
    const result = await executeSql(
      "INSERT INTO exit_reasons (name, severity, rehirable) VALUES (?, ?, ?)",
      [parsed.data.name, parsed.data.severity, parsed.data.rehirable],
    );

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataCreate,
      entityType: "exit_reason",
      entityId: result.insertId,
      details: {
        name: parsed.data.name,
        severity: parsed.data.severity,
        rehirable: parsed.data.rehirable,
      },
    });
  } catch (error) {
    fail(BASE, duplicateMessage(error, "Nama alasan sudah digunakan."));
  }

  done(BASE, "Alasan keluar berhasil ditambahkan.");
}

export async function updateExitReasonAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = exitReasonUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    severity: formData.get("severity"),
    rehirable: formData.get("rehirable"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  try {
    await executeSql(
      "UPDATE exit_reasons SET name = ?, severity = ?, rehirable = ? WHERE id = ?",
      [parsed.data.name, parsed.data.severity, parsed.data.rehirable, parsed.data.id],
    );

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataUpdate,
      entityType: "exit_reason",
      entityId: parsed.data.id,
      details: {
        name: parsed.data.name,
        severity: parsed.data.severity,
        rehirable: parsed.data.rehirable,
      },
    });
  } catch (error) {
    fail(BASE, duplicateMessage(error, "Nama alasan sudah digunakan."));
  }

  done(BASE, "Alasan keluar berhasil diperbarui.");
}

/* ------------------------------ Contract type ------------------------------ */

export async function createContractTypeAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = contractTypeCreateSchema.safeParse({
    name: formData.get("name"),
    defaultMonths: formData.get("defaultMonths"),
    reminderDays: formData.get("reminderDays"),
    isPermanent: formData.get("isPermanent"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  try {
    const result = await executeSql(
      `INSERT INTO contract_types (name, default_months, reminder_days, is_permanent)
       VALUES (?, ?, ?, ?)`,
      [
        parsed.data.name,
        parsed.data.defaultMonths,
        parsed.data.reminderDays,
        parsed.data.isPermanent,
      ],
    );

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataCreate,
      entityType: "contract_type",
      entityId: result.insertId,
      details: { name: parsed.data.name, isPermanent: parsed.data.isPermanent },
    });
  } catch (error) {
    fail(
      BASE,
      duplicateMessage(error, "Nama jenis kontrak sudah digunakan."),
    );
  }

  done(BASE, "Jenis kontrak berhasil ditambahkan.");
}

export async function updateContractTypeAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const parsed = contractTypeUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    defaultMonths: formData.get("defaultMonths"),
    reminderDays: formData.get("reminderDays"),
    isPermanent: formData.get("isPermanent"),
  });

  if (!parsed.success) {
    fail(BASE, firstIssueMessage(parsed.error));
  }

  try {
    await executeSql(
      `UPDATE contract_types
       SET name = ?, default_months = ?, reminder_days = ?, is_permanent = ?
       WHERE id = ?`,
      [
        parsed.data.name,
        parsed.data.defaultMonths,
        parsed.data.reminderDays,
        parsed.data.isPermanent,
        parsed.data.id,
      ],
    );

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.masterDataUpdate,
      entityType: "contract_type",
      entityId: parsed.data.id,
      details: { name: parsed.data.name, isPermanent: parsed.data.isPermanent },
    });
  } catch (error) {
    fail(
      BASE,
      duplicateMessage(error, "Nama jenis kontrak sudah digunakan."),
    );
  }

  done(BASE, "Jenis kontrak berhasil diperbarui.");
}

/* ------------------------- Shared active/delete flows ---------------------- */

interface ActiveEntityConfig {
  table: string;
  path: string;
  label: string;
}

interface DeleteEntityConfig extends ActiveEntityConfig {
  usage: (id: number) => Promise<number>;
}

const ACTIVE_ENTITIES: Record<string, ActiveEntityConfig> = {
  brand: { table: "brands", path: BASE, label: "Brand" },
  company: { table: "companies", path: BASE, label: "CV" },
  division: { table: "divisions", path: BASE, label: "Divisi" },
  position: { table: "positions", path: BASE, label: "Jabatan" },
  location: { table: "locations", path: BASE, label: "Lokasi" },
  exit_reason: {
    table: "exit_reasons",
    path: BASE,
    label: "Alasan keluar",
  },
  contract_type: {
    table: "contract_types",
    path: BASE,
    label: "Jenis kontrak",
  },
};

const DELETE_ENTITIES: Record<string, DeleteEntityConfig> = {
  brand: { ...ACTIVE_ENTITIES.brand, usage: brandUsageCount },
  company: { ...ACTIVE_ENTITIES.company, usage: companyUsageCount },
  division: { ...ACTIVE_ENTITIES.division, usage: divisionUsageCount },
  position: { ...ACTIVE_ENTITIES.position, usage: positionUsageCount },
  location: { ...ACTIVE_ENTITIES.location, usage: locationUsageCount },
  exit_reason: { ...ACTIVE_ENTITIES.exit_reason, usage: exitReasonUsageCount },
  contract_type: { ...ACTIVE_ENTITIES.contract_type, usage: contractTypeUsageCount },
};

export async function setMasterDataActiveAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const entity = String(formData.get("entity") ?? "");
  const config = ACTIVE_ENTITIES[entity];

  if (!config) {
    fail(BASE, "Jenis data master tidak dikenal.");
  }

  const parsed = entityIdSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    fail(config.path, firstIssueMessage(parsed.error));
  }

  const nextActive = formData.get("nextActive") === "1";

  await executeSql(`UPDATE ${config.table} SET is_active = ? WHERE id = ?`, [
    nextActive,
    parsed.data.id,
  ]);

  await logAudit({
    userId: user.id,
    action: nextActive
      ? AUDIT_ACTIONS.masterDataUpdate
      : AUDIT_ACTIONS.masterDataDeactivate,
    entityType: entity,
    entityId: parsed.data.id,
    details: { isActive: nextActive },
  });

  done(
    config.path,
    `${config.label} berhasil ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`,
  );
}

export async function deleteMasterDataAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.masterDataManage);
  const entity = String(formData.get("entity") ?? "");
  const config = DELETE_ENTITIES[entity];

  if (!config) {
    fail(BASE, "Jenis data master tidak dikenal.");
  }

  const parsed = entityIdSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    fail(config.path, firstIssueMessage(parsed.error));
  }

  const usage = await config.usage(parsed.data.id);

  if (usage > 0) {
    fail(
      config.path,
      `${config.label} tidak dapat dihapus karena masih dipakai oleh ${usage} data lain. Nonaktifkan saja.`,
    );
  }

  try {
    await executeSql(`DELETE FROM ${config.table} WHERE id = ?`, [parsed.data.id]);
  } catch (error) {
    fail(
      config.path,
      referenceMessage(
        error,
        `${config.label} tidak dapat dihapus karena masih direferensikan data lain.`,
      ),
    );
  }

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.masterDataDelete,
    entityType: entity,
    entityId: parsed.data.id,
  });

  done(config.path, `${config.label} berhasil dihapus.`);
}
