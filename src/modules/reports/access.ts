import { PERMISSIONS } from "@/core/rbac/permissions";
export interface ReportAccess {
  includePrivate: boolean;
  includeSensitive: boolean;
}
export function reportAccess(user: {
  permissions: readonly string[];
}): ReportAccess {
  return {
    includePrivate: user.permissions.includes(
      PERMISSIONS.employeeViewPrivateFields,
    ),
    includeSensitive: user.permissions.includes(
      PERMISSIONS.employeeViewSensitive,
    ),
  };
}
export interface ReportColumn {
  key: string;
  label: string;
  width: number;
}
const basic: ReportColumn[] = [
  { key: "employee_code", label: "Kode karyawan", width: 20 },
  { key: "full_name", label: "Nama lengkap", width: 30 },
  { key: "brand_name", label: "Brand", width: 22 },
  { key: "company_name", label: "Perusahaan", width: 30 },
  { key: "division_name", label: "Divisi", width: 24 },
  { key: "position_name", label: "Jabatan", width: 25 },
  { key: "location_name", label: "Lokasi kerja", width: 28 },
  { key: "join_date", label: "Tanggal bergabung", width: 20 },
  { key: "service_months", label: "Masa kerja (bulan)", width: 20 },
  { key: "is_active", label: "Status", width: 16 },
  { key: "exit_date", label: "Tanggal keluar", width: 20 },
];
const personal: ReportColumn[] = [
  { key: "birth_place", label: "Tempat lahir", width: 24 },
  { key: "birth_date", label: "Tanggal lahir", width: 20 },
  { key: "blood_type", label: "Golongan darah", width: 18 },
  { key: "mother_name", label: "Nama ibu", width: 28 },
  { key: "religion", label: "Agama", width: 18 },
  { key: "address_current", label: "Alamat domisili", width: 50 },
  { key: "address_ktp", label: "Alamat KTP", width: 50 },
  { key: "email", label: "Email", width: 32 },
  { key: "phone", label: "Telepon", width: 22 },
  { key: "marital_status", label: "Status pernikahan", width: 22 },
  { key: "children_count", label: "Jumlah anak", width: 16 },
  { key: "exit_reason_name", label: "Alasan keluar", width: 30 },
];
const sensitive: ReportColumn[] = [
  { key: "nik", label: "NIK", width: 22 },
  { key: "npwp", label: "NPWP", width: 24 },
  { key: "bank_name", label: "Nama bank", width: 24 },
  { key: "bank_account_number", label: "Nomor rekening", width: 26 },
  { key: "ktp_uploaded", label: "Dokumen KTP", width: 22 },
];
export function reportColumns(access: ReportAccess): ReportColumn[] {
  return [
    ...basic,
    ...(access.includePrivate ? personal : []),
    ...(access.includeSensitive ? sensitive : []),
  ];
}
export function reportValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (key === "is_active") return value ? "Aktif" : "Nonaktif";
  if (key === "ktp_uploaded")
    return value ? "Sudah diunggah" : "Belum diunggah";
  if (key === "marital_status")
    return (
      (
        {
          SINGLE: "Belum menikah",
          MARRIED: "Menikah",
          DIVORCED: "Cerai",
        } as Record<string, string>
      )[String(value)] ?? String(value)
    );
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}
export function projectReportRow(
  row: Record<string, unknown>,
  access: ReportAccess,
): Record<string, string> {
  return Object.fromEntries(
    reportColumns(access).map((c) => [c.key, reportValue(c.key, row[c.key])]),
  );
}
export function safeCsvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
