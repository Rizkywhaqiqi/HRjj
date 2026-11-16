import { z } from "zod";
export const employeePortalLoginSchema = z.object({ employeeCode: z.string().trim().min(1).max(40), email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(72) });
export const selfLeaveSchema = z.object({ leaveTypeId: z.coerce.number().int().positive(), startDate: z.string().date(), endDate: z.string().date(), reason: z.string().trim().max(500).optional() }).refine((value) => value.endDate >= value.startDate, { message: "Tanggal selesai tidak boleh sebelum tanggal mulai.", path: ["endDate"] });
