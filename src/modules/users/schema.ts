import { z } from "zod";
import { passwordSchema } from "@/core/auth/password";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Format email tidak valid")
  .max(150, "Email maksimal 150 karakter");

const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === "1" || value === 1 || value === true,
  z.boolean(),
);

const brandIdList = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  const raw = Array.isArray(value) ? value : [value];

  return raw
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}, z.array(z.number().int().positive()));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password wajib diisi").max(200),
});

export const userCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
    email: emailSchema,
    password: passwordSchema,
    roleId: z.coerce.number().int().positive("Pilih peran"),
    scopeAll: checkbox,
    brandIds: brandIdList,
  })
  .refine((value) => value.scopeAll || value.brandIds.length > 0, {
    path: ["brandIds"],
    message: "Pilih minimal satu brand atau centang akses semua brand.",
  });

export const userUpdateSchema = z
  .object({
    userId: z.coerce.number().int().positive(),
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
    email: emailSchema,
    roleId: z.coerce.number().int().positive("Pilih peran"),
    scopeAll: checkbox,
    isActive: checkbox,
    brandIds: brandIdList,
  })
  .refine((value) => value.scopeAll || value.brandIds.length > 0, {
    path: ["brandIds"],
    message: "Pilih minimal satu brand atau centang akses semua brand.",
  });

export const resetPasswordSchema = z.object({
  userId: z.coerce.number().int().positive(),
  newPassword: passwordSchema,
});

export const revokeSessionsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi").max(200),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi").max(200),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama.",
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ["newPassword"],
    message: "Password baru harus berbeda dari password saat ini.",
  });

export interface LoginActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

export interface ChangePasswordState {
  status: "idle" | "error" | "success";
  message?: string;
}
