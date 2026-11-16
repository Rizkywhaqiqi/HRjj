import { z } from "zod";

const description = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(255).nullable(),
);

const permissionIdList = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  const raw = Array.isArray(value) ? value : [value];

  return raw
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}, z.array(z.number().int().positive()));

export const roleCreateSchema = z.object({
  name: z.string().trim().min(2, "Nama peran minimal 2 karakter").max(80),
  description,
  permissionIds: permissionIdList,
});

export const roleUpdateSchema = z.object({
  roleId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2, "Nama peran minimal 2 karakter").max(80),
  description,
});

export const rolePermissionsSchema = z.object({
  roleId: z.coerce.number().int().positive(),
  permissionIds: permissionIdList,
});

export const roleDeleteSchema = z.object({
  roleId: z.coerce.number().int().positive(),
});

export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
