import { recordPlacement } from "@/modules/finance/placement";
import type {
  Connection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { createBlindIndex, encryptField } from "@/core/crypto/field-encrypt";
import { normalizePhone } from "@/core/normalization";
import type { MaritalStatus } from "@/types/database";

interface EmployeeCodeSequenceRow extends RowDataPacket {
  next_number: number;
}

export interface InsertEmployeeOptions {
  applicationId?: number;
  cvFilePath?: string | null;
  createOnboardingChecklist?: boolean;
}

export interface EmployeeRecordInput {
  employeeCode?: string;
  fullName: string;
  nik: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  addressCurrent: string | null;
  addressKtp: string | null;
  email: string | null;
  phone: string | null;
  npwp?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  companyId: number | null;
  brandId: number;
  positionId: number;
  locationId: number;
  joinDate: string | null;
  maritalStatus: MaritalStatus | null;
  childrenCount: number | null;
}

async function lockEmployeeCodeSequence(
  connection: Connection,
): Promise<number> {
  const [rows] = await connection.execute<EmployeeCodeSequenceRow[]>(
    "SELECT next_number FROM employee_code_sequences WHERE id = 1 FOR UPDATE",
  );
  const nextNumber = Number(rows[0]?.next_number);
  if (!Number.isSafeInteger(nextNumber) || nextNumber < 1) {
    throw new Error("Employee code sequence is not initialized.");
  }
  return nextNumber;
}

async function chooseEmployeeCode(
  connection: Connection,
  requestedCode: string | undefined,
): Promise<string> {
  if (!requestedCode) {
    const nextNumber = await lockEmployeeCodeSequence(connection);
    if (nextNumber >= 4_294_967_295) {
      throw new Error("Employee code sequence is exhausted.");
    }
    await connection.execute(
      "UPDATE employee_code_sequences SET next_number = next_number + 1 WHERE id = 1",
    );
    return `EMP-${String(nextNumber).padStart(6, "0")}`;
  }

  const match = /^EMP-(\d+)$/i.exec(requestedCode);
  if (!match) return requestedCode;

  const nextNumber = await lockEmployeeCodeSequence(connection);
  const requestedNumber = Number(match[1]);
  if (
    Number.isSafeInteger(requestedNumber) &&
    requestedNumber < 4_294_967_295 &&
    requestedNumber >= nextNumber
  ) {
    await connection.execute(
      "UPDATE employee_code_sequences SET next_number = ? WHERE id = 1",
      [requestedNumber + 1],
    );
  }
  return requestedCode;
}

export async function insertEmployeeRecord(
  connection: Connection,
  data: EmployeeRecordInput,
  ktpPhotoPath: string | null,
  options: InsertEmployeeOptions = {},
): Promise<{ employeeId: number; employeeCode: string }> {
  const employeeCode = await chooseEmployeeCode(connection, data.employeeCode);
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO employees
      (employee_code, full_name, nik_encrypted, nik_hash, birth_place, birth_date,
      address_current, address_ktp, email, phone, npwp_encrypted, bank_name,
      bank_account_encrypted, ktp_photo_path, cv_file_path, marital_status,
      children_count, company_id, brand_id, position_id, location_id, join_date,
      is_active, application_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
    [
      employeeCode,
      data.fullName,
      data.nik ? encryptField(data.nik) : null,
      data.nik ? createBlindIndex(data.nik) : null,
      data.birthPlace,
      data.birthDate,
      data.addressCurrent,
      data.addressKtp,
      data.email,
      data.phone ? normalizePhone(data.phone) : null,
      data.npwp ? encryptField(data.npwp) : null,
      data.bankName ?? null,
      data.bankAccountNumber ? encryptField(data.bankAccountNumber) : null,
      ktpPhotoPath,
      options.cvFilePath ?? null,
      data.maritalStatus,
      data.childrenCount,
      data.companyId,
      data.brandId,
      data.positionId,
      data.locationId,
      data.joinDate,
      options.applicationId ?? null,
    ],
  );

  await recordPlacement(connection, result.insertId, null, "Penempatan awal saat karyawan dicatat");
  return { employeeId: result.insertId, employeeCode };
}
