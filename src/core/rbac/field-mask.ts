import { PERMISSIONS } from "./permissions";
import type { MaritalStatus, SessionUser } from "@/types/database";

const MASK = "\u2022".repeat(8);

/** Masks an identifier while keeping the first and last characters visible. */
export function maskIdentifier(value: string | null | undefined, visibleStart = 4, visibleEnd = 4): string | null {
  if (!value) return null;
  if (value.length <= visibleStart + visibleEnd) return MASK;
  return `${value.slice(0, visibleStart)}${MASK}${value.slice(-visibleEnd)}`;
}

export interface MaskableEmployeeFields {
  nik: string | null;
  npwp: string | null;
  bankAccountNumber: string | null;
  ktpPhotoPath: string | null;
  addressCurrent: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  motherName: string | null;
  religion: string | null;
  maritalStatus: MaritalStatus | null;
  childrenCount: number | null;
  cvFilePath: string | null;
}

export interface MaskedEmployeeFields extends MaskableEmployeeFields {
  sensitiveMasked: boolean;
  privateFieldsMasked: boolean;
  ktpPhotoAccessible: boolean;
}

/** Applies the server-side RBAC field policy before employee data is rendered or returned. */
export function maskSensitiveFields(user: SessionUser, fields: MaskableEmployeeFields): MaskedEmployeeFields {
  const canViewSensitive = user.permissions.includes(PERMISSIONS.employeeViewSensitive);
  const canViewPrivate = user.permissions.includes(PERMISSIONS.employeeViewPrivateFields);
  return {
    nik: canViewSensitive ? fields.nik : maskIdentifier(fields.nik),
    npwp: canViewSensitive ? fields.npwp : maskIdentifier(fields.npwp),
    bankAccountNumber: canViewSensitive ? fields.bankAccountNumber : maskIdentifier(fields.bankAccountNumber),
    ktpPhotoPath: canViewSensitive ? fields.ktpPhotoPath : null,
    cvFilePath: canViewPrivate ? fields.cvFilePath : null,
    addressCurrent: canViewPrivate ? fields.addressCurrent : null,
    birthPlace: canViewPrivate ? fields.birthPlace : null,
    birthDate: canViewPrivate ? fields.birthDate : null,
    email: canViewPrivate ? fields.email : null,
    phone: canViewPrivate ? fields.phone : null,
    motherName: canViewPrivate ? fields.motherName : null,
    religion: canViewPrivate ? fields.religion : null,
    maritalStatus: canViewPrivate ? fields.maritalStatus : null,
    childrenCount: canViewPrivate ? fields.childrenCount : null,
    sensitiveMasked: !canViewSensitive,
    privateFieldsMasked: !canViewPrivate,
    ktpPhotoAccessible: canViewSensitive && Boolean(fields.ktpPhotoPath),
  };
}
