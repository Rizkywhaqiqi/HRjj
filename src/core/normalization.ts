/** Stores phone numbers in a stable digits-only representation. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+62")) return `0${digits.slice(3)}`;
  if (digits.startsWith("62") && !digits.startsWith("620")) return `0${digits.slice(2)}`;
  return digits;
}
