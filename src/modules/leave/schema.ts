import { z } from "zod";
export const leaveRequestSchema = z.object({ employeeId: z.coerce.number().int().positive(), leaveTypeId: z.coerce.number().int().positive(), startDate: z.string().date(), endDate: z.string().date(), reason: z.string().trim().max(500).optional() }).refine((value) => value.endDate >= value.startDate, { message: "Tanggal selesai tidak boleh sebelum tanggal mulai.", path: ["endDate"] });
export const leaveDecisionSchema = z.object({ requestId: z.coerce.number().int().positive(), status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]) });
