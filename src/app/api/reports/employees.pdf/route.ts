import { NextResponse } from "next/server";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listEmployeeReport } from "@/modules/reports";
import { reportAccess } from "@/modules/reports/access";
import { reportFilters } from "@/modules/reports/filters";
import { renderEmployeeReportPdf } from "@/modules/reports/pdf";
import { logAudit } from "@/core/audit/log";
import {
  listBrandOptions,
  listCompanyOptions,
  listDivisionOptions,
  listLocations,
} from "@/modules/master-data";
export async function GET(request: Request) {
  const actor = await requirePermission(PERMISSIONS.reportExport);
  await requireFeatureEnabled("reports");
  const access = reportAccess(actor);
  const filters = reportFilters(new URL(request.url).searchParams);
  const [rows, brands, companies, divisions, locations] = await Promise.all([
    listEmployeeReport(actor, filters, access),
    listBrandOptions(actor),
    listCompanyOptions(actor),
    listDivisionOptions(),
    listLocations(actor),
  ]);
  const filterDescription =
    [
      filters.search ? `Pencarian: ${filters.search}` : null,
      filters.status
        ? `Status: ${filters.status === "active" ? "Aktif" : "Nonaktif"}`
        : null,
      filters.incompleteOnly ? "Profil aktif belum lengkap" : null,
      filters.brandId
        ? `Brand: ${brands.find((b) => b.id === filters.brandId)?.name ?? "Tidak ditemukan"}`
        : null,
      filters.companyId
        ? `Perusahaan: ${companies.find((b) => b.id === filters.companyId)?.name ?? "Tidak ditemukan"}`
        : null,
      filters.divisionId
        ? `Divisi: ${divisions.find((b) => b.id === filters.divisionId)?.name ?? "Tidak ditemukan"}`
        : null,
      filters.locationId
        ? `Lokasi: ${locations.find((b) => b.id === filters.locationId)?.name ?? "Tidak ditemukan"}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ") || "Semua karyawan dalam akses brand Anda";
  const pdf = await renderEmployeeReportPdf(rows, access, filterDescription);
  await logAudit({
    userId: actor.id,
    action: "security.export",
    entityType: "employee_report",
    details: { format: "pdf", rowCount: rows.length, ...access },
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=employee-report.pdf",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
