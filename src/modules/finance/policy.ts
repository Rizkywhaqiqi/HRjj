import { z } from "zod";
export function jakartaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function financePeriod(raw: unknown): {
  month: string;
  start: string;
  end: string;
} {
  const value =
    typeof raw === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) &&
    Number(raw.slice(0, 4)) >= 2000 &&
    Number(raw.slice(0, 4)) <= 2100
      ? raw
      : jakartaToday().slice(0, 7);
  const [y, m] = value.split("-").map(Number);
  return {
    month: value,
    start: `${value}-01`,
    end: `${value}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`,
  };
}
export const salaryRequestSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  // Accept decimal text, never currency separators or scientific notation.
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,13}(\.\d{1,2})?$/, "Isi nominal angka tanpa pemisah ribuan.")
    .refine((v) => Number(v) <= 1e12, "Nominal terlalu besar."),
  effectiveDate: z.string().date(),
  reason: z.string().trim().min(10, "Alasan minimal 10 karakter.").max(1000),
});
export const salaryDecisionSchema = z.object({
  id: z.coerce.number().int().positive(),
  decision: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
  note: z.string().trim().min(5, "Catatan minimal 5 karakter.").max(1000),
});
export function assertSalaryDecision(
  request: { status: string; requested_by: number },
  actorId: number,
  decision: string,
) {
  if (request.status !== "PENDING")
    throw new Error("Pengajuan sudah diproses. Muat ulang halaman.");
  if (decision === "CANCELLED") {
    if (request.requested_by !== actorId)
      throw new Error("Hanya pengaju yang dapat membatalkan pengajuan.");
  } else if (request.requested_by === actorId)
    throw new Error("Pengaju tidak boleh memutuskan pengajuannya sendiri.");
}
export function money(value: unknown): string {
  return value === null || value === undefined
    ? "Belum dicatat"
    : new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 2,
      }).format(Number(value));
}
