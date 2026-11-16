import { z } from "zod";
export const payrollSchema = z.object({ employeeId: z.coerce.number().int().positive(), periodMonth: z.string().regex(/^\d{4}-\d{2}$/), baseSalary: z.coerce.number().nonnegative(), bpjsHealth: z.coerce.number().nonnegative(), bpjsEmployment: z.coerce.number().nonnegative(), otherDeductions: z.coerce.number().nonnegative(), notes: z.string().trim().max(500).optional() });
