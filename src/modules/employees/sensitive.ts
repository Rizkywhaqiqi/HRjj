/** Includes fields that can be submitted directly even when the form hides them. */
export function hasSensitiveEmployeeChanges(form: FormData): boolean {
  const nik = form.get("nik");
  const ktp = form.get("ktpPhoto");
  return (
    (typeof nik === "string" && nik.trim() !== "") ||
    (ktp instanceof File && ktp.size > 0) ||
    ["npwp", "bankName", "bankAccountNumber"].some((key) => form.has(key))
  );
}
