import { z } from "zod";

export const contractCreateSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  contractTypeId: z.coerce.number().int().positive(),
  startDate: z.string().date(),
  endDate: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().date().nullable(),
  ),
  baseSalary: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().nonnegative().nullable(),
  ),
});

export const contractDecisionSchema = z
  .object({
    contractId: z.coerce.number().int().positive(),
    decision: z.enum(["EXTEND", "PERMANENT", "NOT_EXTEND"]),
    newContractTypeId: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.number().int().positive().nullable(),
    ),
    newStartDate: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.string().date().nullable(),
    ),
    newEndDate: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.string().date().nullable(),
    ),
    exitReasonId: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.number().int().positive().nullable(),
    ),
  })
  .superRefine((value, ctx) => {
    if (
      value.decision === "EXTEND" &&
      (!value.newContractTypeId || !value.newStartDate || !value.newEndDate)
    )
      ctx.addIssue({
        code: "custom",
        message: "Data kontrak perpanjangan wajib diisi.",
      });
    if (value.decision === "NOT_EXTEND" && !value.exitReasonId)
      ctx.addIssue({ code: "custom", message: "Alasan keluar wajib diisi." });
  });
