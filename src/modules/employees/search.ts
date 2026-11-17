export function employeeSearch(search: string): { clause: string; params: string[] } {
  const normalized = search.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!normalized) return { clause: "1 = 1", params: [] };
  if (normalized.length === 1) return { clause: "1 = 0", params: [] };
  const term = `${normalized.replace(/[\\%_]/g, "\\$&")}%`;
  return { clause: "(e.employee_code LIKE ? OR e.full_name LIKE ? OR e.phone LIKE ?)", params: [term, term, term] };
}
