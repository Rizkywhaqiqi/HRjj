import { z } from "zod";

const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === "1" || value === 1 || value === true,
  z.boolean(),
);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable(),
  );

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().toLowerCase().email("Format email tidak valid").max(100).nullable(),
);

const requiredId = z.coerce.number().int().positive("Pilih data yang valid");

export const entityIdSchema = z.object({ id: requiredId });

const optionalId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().int().positive().nullable(),
);

export const brandCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kode brand minimal 2 karakter")
    .max(30)
    .regex(/^[A-Za-z0-9_]+$/, "Kode hanya boleh huruf, angka, dan garis bawah")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2, "Nama brand minimal 2 karakter").max(100),
  description: optionalText(1000),
});

export const brandUpdateSchema = brandCreateSchema.extend({ id: requiredId });

export const companyCreateSchema = z.object({
  brandId: requiredId,
  name: z.string().trim().min(2, "Nama CV minimal 2 karakter").max(150),
  address: optionalText(1000),
  phone: optionalText(50),
  email: optionalEmail,
  npwp: optionalText(50),
  nib: optionalText(50),
});

export const companyUpdateSchema = companyCreateSchema.extend({ id: requiredId });

export const divisionCreateSchema = z.object({
  name: z.string().trim().min(2, "Nama divisi minimal 2 karakter").max(100),
});

export const divisionUpdateSchema = divisionCreateSchema.extend({ id: requiredId });

export const positionCreateSchema = z.object({
  divisionId: requiredId,
  name: z.string().trim().min(2, "Nama jabatan minimal 2 karakter").max(120),
});

export const positionUpdateSchema = positionCreateSchema.extend({ id: requiredId });

export const locationCreateSchema = z.object({
  brandId: optionalId,
  name: z.string().trim().min(2, "Nama lokasi minimal 2 karakter").max(150),
  city: optionalText(100),
  address: optionalText(1000),
});

export const locationUpdateSchema = locationCreateSchema.extend({ id: requiredId });

export const exitReasonCreateSchema = z.object({
  name: z.string().trim().min(3, "Nama alasan minimal 3 karakter").max(150),
  severity: z.enum(["GREEN", "YELLOW", "RED"], "Pilih tingkat keparahan"),
  rehirable: checkbox,
});

export const exitReasonUpdateSchema = exitReasonCreateSchema.extend({ id: requiredId });

export const contractTypeCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Nama jenis kontrak minimal 2 karakter").max(100),
    defaultMonths: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? null : value),
      z.coerce.number().int().min(1).max(120).nullable(),
    ),
    reminderDays: z.coerce.number().int().min(0).max(365),
    isPermanent: checkbox,
  })
  .refine((value) => !value.isPermanent || value.defaultMonths === null, {
    message: "Kontrak permanen tidak boleh memiliki durasi bulan",
    path: ["defaultMonths"],
  });

export const contractTypeUpdateSchema = contractTypeCreateSchema.and(
  z.object({ id: requiredId }),
);

export type BrandCreateInput = z.infer<typeof brandCreateSchema>;
export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
export type DivisionCreateInput = z.infer<typeof divisionCreateSchema>;
export type PositionCreateInput = z.infer<typeof positionCreateSchema>;
export type LocationCreateInput = z.infer<typeof locationCreateSchema>;
export type ExitReasonCreateInput = z.infer<typeof exitReasonCreateSchema>;
export type ContractTypeCreateInput = z.infer<typeof contractTypeCreateSchema>;
