import type { EmployeeListFilters } from "@/modules/employees/queries";
export function reportFilters(params: URLSearchParams): EmployeeListFilters {
  const id = (key: string) => {
    const n = Number(params.get(key));
    return Number.isSafeInteger(n) && n > 0 ? n : undefined;
  };
  const status = params.get("status");
  return {
    search: params.get("search")?.trim().slice(0, 80) || undefined,
    brandId: id("brand"),
    companyId: id("company"),
    divisionId: id("division"),
    locationId: id("location"),
    status: status === "active" || status === "inactive" ? status : undefined,
    incompleteOnly: params.get("incomplete") === "1",
  };
}
export function reportFilterQuery(
  filters: EmployeeListFilters,
): Record<string, string> {
  return {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.brandId ? { brand: String(filters.brandId) } : {}),
    ...(filters.companyId ? { company: String(filters.companyId) } : {}),
    ...(filters.divisionId ? { division: String(filters.divisionId) } : {}),
    ...(filters.locationId ? { location: String(filters.locationId) } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.incompleteOnly ? { incomplete: "1" } : {}),
  };
}
