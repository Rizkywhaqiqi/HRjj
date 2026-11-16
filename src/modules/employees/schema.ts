import { z } from "zod";

export const employeeCreateSchema = z.object({
  employeeCode: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(2).max(40).optional(),
  ),
  fullName: z.string().trim().min(2).max(150),
  nik: z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit"),
  birthPlace: z.string().trim().min(2).max(100),
  birthDate: z.string().date(),
  addressCurrent: z.string().trim().min(5).max(2000),
  addressKtp: z.string().trim().min(5).max(2000),
  email: z.preprocess((v) => typeof v === "string" && v.trim() === "" ? null : v, z.string().trim().toLowerCase().email().max(150).nullable()),
  phone: z.string().trim().min(8).max(30),
  npwp: z.preprocess((v) => typeof v === "string" && v.trim() === "" ? null : v, z.string().trim().max(50).nullable().optional()),
  bankName: z.preprocess((v) => typeof v === "string" && v.trim() === "" ? null : v, z.string().trim().max(60).nullable().optional()),
  bankAccountNumber: z.preprocess((v) => typeof v === "string" && v.trim() === "" ? null : v, z.string().trim().max(50).nullable().optional()),
  companyId: z.coerce.number().int().positive(),
  positionId: z.coerce.number().int().positive(),
  locationId: z.coerce.number().int().positive(),
  joinDate: z.string().date(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED"]),
  childrenCount: z.coerce.number().int().min(0).max(30),
});

function emptyToNull(value: unknown): unknown {
  return value === undefined ||
    (typeof value === "string" && value.trim() === "")
    ? null
    : value;
}

function emptyToUndefined(value: unknown): unknown {
  return value === undefined ||
    (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;
}

const nullablePositiveId = z.preprocess(
  emptyToNull,
  z.union([z.coerce.number().int().positive(), z.null()]),
);

function nullableText(min: number, max: number) {
  return z.preprocess(
    emptyToNull,
    z.string().trim().min(min).max(max).nullable(),
  );
}

export const employeeActivationSchema = z.object({
  employeeCode: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(2).max(40).optional(),
  ),
  fullName: z.string().trim().min(2).max(150),
  nik: z.preprocess(
    emptyToNull,
    z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit").nullable(),
  ),
  birthPlace: nullableText(2, 100),
  birthDate: z.preprocess(
    emptyToNull,
    z.string().date().nullable(),
  ),
  addressCurrent: nullableText(5, 2000),
  addressKtp: nullableText(5, 2000),
  email: z.preprocess(
    emptyToNull,
    z.string().trim().toLowerCase().email().max(150).nullable(),
  ),
  phone: nullableText(8, 30),
  npwp: z.preprocess(
    emptyToNull,
    z.string().trim().max(50).nullable().optional(),
  ),
  bankName: z.preprocess(
    emptyToNull,
    z.string().trim().max(60).nullable().optional(),
  ),
  bankAccountNumber: z.preprocess(
    emptyToNull,
    z.string().trim().max(50).nullable().optional(),
  ),
  companyId: z.coerce.number().int().positive(),
  positionId: z.coerce.number().int().positive(),
  locationId: z.coerce.number().int().positive(),
  joinDate: z.preprocess(
    emptyToNull,
    z.string().date().nullable(),
  ),
  maritalStatus: z.preprocess(
    emptyToNull,
    z.enum(["SINGLE", "MARRIED", "DIVORCED"]).nullable(),
  ),
  childrenCount: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).max(30).nullable(),
  ),
});

export const deactivateEmployeeSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  exitDate: z.string().date(),
  exitReasonId: z.coerce.number().int().positive(),
});

export const employeeUpdateSchema = employeeActivationSchema.extend({
  employeeCode: z.string().trim().min(2).max(40),
  employeeId: z.coerce.number().int().positive(),
  companyId: nullablePositiveId,
  nik: z.preprocess(
    emptyToUndefined,
    z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit").optional(),
  ),
});

export const employeeImportSchema = employeeActivationSchema.extend({
  companyId: nullablePositiveId,
  brandId: nullablePositiveId,
}).superRefine((data, context) => {
  if (data.companyId === null && data.brandId === null) {
    context.addIssue({
      code: "custom",
      path: ["brandId"],
      message: "Pilih brand jika CV belum ditentukan.",
    });
  }
});

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeActivationInput = z.infer<typeof employeeActivationSchema>;
export type EmployeeImportInput = z.infer<typeof employeeImportSchema>;
