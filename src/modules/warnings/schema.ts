import { z } from "zod";
export const warningCreateSchema = z.object({ employeeId: z.coerce.number().int().positive(), warningType: z.enum(["SP1", "SP2", "SP3"]), issueDate: z.string().date(), expiryDate: z.preprocess((v) => v === "" ? null : v, z.string().date().nullable()), notes: z.string().trim().max(500).optional() });
export const warningStatusSchema = z.object({ warningId: z.coerce.number().int().positive(), status: z.enum(["ACTIVE", "EXPIRED", "RESOLVED"]) });
