export const EMPLOYEE_IMPORT_VERSION = "hrjj-employees-v1";
export const EMPLOYEE_IMPORT_COLUMNS = [
  "employeeCode",
  "fullName",
  "brandName",
  "companyName",
  "positionName",
  "locationName",
  "joinDate",
  "nik",
  "birthPlace",
  "birthDate",
  "addressCurrent",
  "addressKtp",
  "email",
  "phone",
  "maritalStatus",
  "childrenCount",
] as const;
export interface OrganizationReference {
  id: number;
  name: string;
  parentId?: number | null;
}
export function resolveOrganizationName(
  value: unknown,
  options: OrganizationReference[],
  label: string,
): number | null {
  const name = String(value ?? "")
    .trim()
    .toLocaleLowerCase("id-ID");
  if (!name) return null;
  const matches = options.filter(
    (o) => o.name.trim().toLocaleLowerCase("id-ID") === name,
  );
  if (matches.length !== 1)
    throw new Error(
      `${label} tidak ditemukan atau namanya ambigu. Gunakan pilihan pada sheet Referensi atau ID master.`,
    );
  return matches[0].id;
}
