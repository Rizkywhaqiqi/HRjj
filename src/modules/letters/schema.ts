import { z } from "zod";
export type LetterType = "SP" | "SKK" | "CONTRACT" | "NDA" | "STILL_WORKING";

export const letterCreateSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  contractId: z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().int().positive().optional()),
  linkContract: z.preprocess((value) => value === "1" ? true : value === "0" ? false : value, z.boolean().optional()),
  type: z.enum(["SP", "SKK", "CONTRACT", "NDA", "STILL_WORKING"]),
  issuedDate: z.string().date(),
  offerStartDate: z.preprocess((value) => value === "" || value === null ? null : value, z.string().date().nullable().optional()),
  offerEndDate: z.preprocess((value) => value === "" || value === null ? null : value, z.string().date().nullable().optional()),
  offeredSalary: z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.number().nonnegative().nullable().optional()),
  offeredContractType: z.string().trim().max(100).optional(),
  reportingTo: z.string().trim().max(150).optional(),
  trainingPeriod: z.string().trim().max(80).optional(),
  workHours: z.string().trim().max(100).optional(),
  metadata: z.string().max(5000).optional(),
});
export const letterTemplateSchema = z.object({ name: z.string().trim().min(2).max(120), type: z.enum(["SP", "SKK", "CONTRACT", "NDA", "STILL_WORKING"]), companyId: z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().int().positive().optional()) });
