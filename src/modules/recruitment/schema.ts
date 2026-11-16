import { z } from "zod";
import { emailSchema } from "@/modules/users/schema";
import { passwordSchema } from "@/core/auth/password";
import { normalizePhone } from "@/core/normalization";

export const candidateRegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: emailSchema,
  phone: z.string().trim().min(8).max(30),
  password: passwordSchema,
});

export const candidateLoginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });
export const applicationSchema = z.object({ vacancyId: z.coerce.number().int().positive(), consent: z.literal("on") });
export const withdrawConsentSchema = z.object({ applicationId: z.coerce.number().int().positive() });
export const candidateAnonymizeSchema = z.object({ confirmation: z.literal("on") });
export const applicationDecisionSchema = z.object({
  applicationId: z.coerce.number().int().positive(),
  decision: z.enum(["ACCEPTED", "REJECTED"]),
  reason: z.string().trim().min(3, "Alasan keputusan wajib diisi.").max(255),
});
export const candidateImportRowSchema = z.object({
  fullName: z.string().trim().min(2, "Nama minimal 2 karakter.").max(150),
  email: emailSchema,
  phone: z.string().trim().min(8).max(30)
    .transform(normalizePhone)
    .refine((value) => /^\d{8,15}$/.test(value), "Nomor telepon tidak valid."),
  consent: z.preprocess(
    (value) => String(value ?? "").trim().toUpperCase(),
    z.string().refine(
      (value) => ["YA", "YES", "TRUE", "1"].includes(value),
      "Kolom consent wajib berisi YA.",
    ),
  ),
});
export const candidateProfileSchema = z.object({ fullName: z.string().trim().min(2).max(150), phone: z.string().trim().min(8).max(30), nik: z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit"), birthPlace: z.string().trim().min(2).max(100), birthDate: z.string().date(), addressCurrent: z.string().trim().min(5).max(2000), lastEducation: z.string().trim().max(100) });
export const vacancyCreateSchema = z.object({ companyId: z.coerce.number().int().positive(), positionId: z.coerce.number().int().positive(), locationId: z.coerce.number().int().positive(), title: z.string().trim().min(3).max(150), description: z.string().trim().min(10).max(10000), requirements: z.string().trim().min(10).max(10000), quota: z.coerce.number().int().min(1).max(1000) });
export const vacancyStatusSchema = z.object({ vacancyId: z.coerce.number().int().positive(), status: z.enum(["DRAFT", "OPEN", "CLOSED"]) });
