import { z } from "zod";
export type { LetterType } from "./templates";
const optionalDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().date().optional(),
);
export const letterCreateSchema = z
  .object({
    employeeId: z.coerce.number().int().positive(),
    contractId: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().int().positive().optional(),
    ),
    previousContractId: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().int().positive().optional(),
    ),
    contractTypeId: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().int().positive().optional(),
    ),
    type: z.enum(["SP", "SKK", "CONTRACT", "NDA", "STILL_WORKING"]),
    issuedDate: z.string().date(),
    startDate: optionalDate,
    endDate: optionalDate,
    salary: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().nonnegative().max(1e12).optional(),
    ),
    purpose: z.string().trim().max(500).default(""),
    warningLevel: z.enum(["SP1", "SP2", "SP3"]).default("SP1"),
    incident: z.string().trim().max(2000).default(""),
    terms: z.string().trim().max(12000).default(""),
    signatory: z
      .string()
      .trim()
      .min(2, "Nama penandatangan wajib diisi")
      .max(150),
  })
  .superRefine((d, c) => {
    const issue = (path: string, message: string) =>
      c.addIssue({ code: "custom", path: [path], message });
    if (d.startDate && d.endDate && d.endDate < d.startDate)
      issue("endDate", "Tanggal akhir tidak boleh sebelum tanggal mulai.");
    if (["CONTRACT", "SP", "NDA"].includes(d.type) && !d.startDate)
      issue("startDate", "Tanggal mulai wajib diisi.");
    if (d.type === "SP" && (!d.incident || !d.endDate))
      issue(
        "incident",
        "SP membutuhkan uraian kejadian dan tanggal akhir berlaku.",
      );
    if (["SKK", "STILL_WORKING"].includes(d.type) && !d.purpose)
      issue("purpose", "Keperluan surat wajib diisi.");
    if (["CONTRACT", "NDA"].includes(d.type) && !d.terms)
      issue("terms", "Ketentuan perjanjian wajib diisi.");
    if (
      (d.contractId || d.previousContractId || d.contractTypeId) &&
      d.type !== "CONTRACT"
    )
      issue("contractId", "Data kontrak hanya untuk surat kontrak kerja.");
    if (d.contractId && d.previousContractId)
      issue(
        "contractId",
        "Pilih kontrak yang sudah ada atau buat perpanjangan baru.",
      );
    if (d.type === "CONTRACT" && !d.contractId && !d.contractTypeId)
      issue(
        "contractTypeId",
        "Jenis kontrak wajib dipilih agar pengingat tercatat.",
      );
    if (d.type === "CONTRACT" && d.salary === undefined)
      issue("salary", "Gaji pokok wajib diisi.");
  });
