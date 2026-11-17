import { z } from "zod";
export const LETTER_LABELS = {
  SP: "Surat peringatan",
  SKK: "Surat keterangan kerja",
  CONTRACT: "Kontrak kerja",
  NDA: "Perjanjian kerahasiaan (NDA)",
  STILL_WORKING: "Surat masih bekerja",
} as const;
export type LetterType = keyof typeof LETTER_LABELS;
// Immutable rendering contract: add v2 instead of changing the layout of v1.
export const snapshotSchema = z.object({
  version: z.literal(1),
  title: z.string(),
  employeeName: z.string(),
  employeeCode: z.string(),
  company: z.string(),
  position: z.string(),
  location: z.string(),
  date: z.string().date(),
  signatory: z.string(),
  paragraphs: z.array(z.string()),
  template: z.enum(["SP", "SKK", "CONTRACT", "NDA", "STILL_WORKING"]),
});
export type LetterSnapshot = z.infer<typeof snapshotSchema>;
export interface TemplateInput {
  type: LetterType;
  fullName: string;
  employeeCode: string;
  company: string;
  position: string;
  location: string;
  issuedDate: string;
  joinDate: string;
  startDate: string;
  endDate: string;
  salary: string;
  purpose: string;
  warningLevel: string;
  incident: string;
  terms: string;
  signatory: string;
}
export function createSnapshot(d: TemplateInput): LetterSnapshot {
  const identity = `${d.fullName} (${d.employeeCode}), jabatan ${d.position}, lokasi kerja ${d.location}.`;
  const paragraphs: Record<LetterType, string[]> = {
    SP: [
      `Kepada ${identity}`,
      `Surat peringatan ${d.warningLevel} ini diberikan sehubungan dengan: ${d.incident}`,
      `Masa berlaku peringatan: ${d.startDate} sampai ${d.endDate}.`,
      "Karyawan diminta memperbaiki perilaku dan mematuhi ketentuan perusahaan.",
      d.terms,
    ],
    SKK: [
      `Dengan ini ${d.company} menerangkan bahwa ${identity}`,
      `Periode bekerja: ${d.startDate || d.joinDate} sampai ${d.endDate || "sekarang"}.`,
      `Surat ini dibuat untuk keperluan ${d.purpose}.`,
    ],
    STILL_WORKING: [
      `Dengan ini ${d.company} menerangkan bahwa ${identity}`,
      `Karyawan bergabung pada ${d.joinDate} dan masih berstatus aktif pada tanggal ${d.issuedDate}.`,
      `Surat ini dibuat untuk keperluan ${d.purpose}.`,
    ],
    CONTRACT: [
      `Perjanjian ini dibuat antara ${d.company} dan ${identity}`,
      `Periode kontrak: ${d.startDate} sampai ${d.endDate || "tidak ditentukan"}.`,
      `Gaji pokok: Rp${d.salary}.`,
      "Ketentuan kerja yang disepakati:",
      d.terms,
      "Para pihak menyatakan telah membaca dan menyetujui ketentuan dalam perjanjian ini.",
      "Tanda tangan karyawan: ____________________",
    ],
    NDA: [
      `Perjanjian kerahasiaan ini dibuat antara ${d.company} dan ${identity}`,
      `Masa berlaku: ${d.startDate} sampai ${d.endDate || "sesuai ketentuan di bawah"}.`,
      "Ruang lingkup dan kewajiban kerahasiaan:",
      d.terms,
      "Para pihak sepakat menjaga informasi yang tercakup dalam perjanjian ini.",
      "Tanda tangan karyawan: ____________________",
    ],
  };
  return snapshotSchema.parse({
    version: 1,
    title: LETTER_LABELS[d.type],
    employeeName: d.fullName,
    employeeCode: d.employeeCode,
    company: d.company,
    position: d.position,
    location: d.location,
    date: d.issuedDate,
    signatory: d.signatory,
    paragraphs: paragraphs[d.type].filter(Boolean),
    template: d.type,
  });
}
export function parseSnapshot(value: unknown): LetterSnapshot | null {
  try {
    const metadata = typeof value === "string" ? JSON.parse(value) : value;
    return snapshotSchema.parse(metadata?.snapshot);
  } catch {
    return null;
  }
}
