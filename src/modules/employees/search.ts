export function employeeSearch(search: string, includePhone = false): { clause: string; params: string[] } {
  const normalized = search.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!normalized) return { clause: "1 = 1", params: [] };
  if (normalized.length === 1) return { clause: "1 = 0", params: [] };
  const term = `${normalized.replace(/[\\%_]/g, "\\$&")}%`;
  return includePhone ? { clause: "(e.employee_code LIKE ? OR e.full_name LIKE ? OR e.phone LIKE ?)", params: [term, term, term] } : { clause: "(e.employee_code LIKE ? OR e.full_name LIKE ?)", params: [term, term] };
}
