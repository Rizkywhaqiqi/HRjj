import PDFDocument from "pdfkit";
import { hasPermission, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listEmployeeReport } from "@/modules/reports";
import type { EmployeeListFilters } from "@/modules/employees/queries";
import { logAudit } from "@/core/audit/log";
import { listBrandOptions, listCompanyOptions, listDivisionOptions, listLocations } from "@/modules/master-data";

function positiveInt(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function getFilters(request: Request): EmployeeListFilters {
  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status");
  return {
    search: url.searchParams.get("search") ?? undefined,
    brandId: positiveInt(url.searchParams.get("brand")),
    companyId: positiveInt(url.searchParams.get("company")),
    divisionId: positiveInt(url.searchParams.get("division")),
    locationId: positiveInt(url.searchParams.get("location")),
    status: rawStatus === "active" || rawStatus === "inactive" ? rawStatus : undefined,
  };
}

function safeText(value: string | null | undefined): string {
  return value?.trim() || "-";
}

async function renderPdf(
  rows: Awaited<ReturnType<typeof listEmployeeReport>>,
  filters: EmployeeListFilters,
  access: { includePrivate: boolean; includeSensitive: boolean },
  filterLabels: { brand?: string; company?: string; division?: string; location?: string },
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32, bufferPages: true });
  const chunks: Buffer[] = [];
  const buffer = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = 32;
  const contentWidth = 778;
  const columns: Array<{ title: string; width: number; key: string }> = [
    { title: "No", width: 28, key: "no" },
    { title: "Kode", width: 58, key: "employee_code" },
    { title: "Nama", width: 126, key: "full_name" },
    { title: "Brand", width: 82, key: "brand_name" },
    { title: "CV", width: 112, key: "company_name" },
    { title: "Divisi", width: 88, key: "division_name" },
    { title: "Jabatan", width: 105, key: "position_name" },
    { title: "Lokasi", width: 95, key: "location_name" },
    { title: "Status", width: 84, key: "status" },
  ];
  if (access.includePrivate) {
    columns.splice(8, 0,
      { title: "Tgl lahir", width: 72, key: "birth_date" },
      { title: "Telepon", width: 82, key: "phone" },
      { title: "Email", width: 105, key: "email" },
      { title: "Alamat", width: 135, key: "address_current" },
    );
  }
  if (access.includeSensitive) {
    columns.splice(columns.length - 1, 0,
      { title: "NIK", width: 95, key: "nik" },
      { title: "NPWP", width: 95, key: "npwp" },
      { title: "Bank", width: 72, key: "bank_name" },
      { title: "Rekening", width: 95, key: "bank_account_number" },
    );
  }
  const scale = contentWidth / columns.reduce((sum, column) => sum + column.width, 0);
  for (const column of columns) column.width *= scale;

  const filterParts = [
    filters.search ? `Pencarian: ${filters.search}` : null,
    filters.status === "active" ? "Status: Aktif" : filters.status === "inactive" ? "Status: Nonaktif" : null,
    filterLabels.brand ? `Brand: ${filterLabels.brand}` : null,
    filterLabels.company ? `CV: ${filterLabels.company}` : null,
    filterLabels.division ? `Divisi: ${filterLabels.division}` : null,
    filterLabels.location ? `Lokasi: ${filterLabels.location}` : null,
  ].filter(Boolean).join(" · ") || "Semua karyawan";

  const drawHeader = () => {
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text("JOJO GROUP MANAGEMENT", left, 32);
    doc.font("Helvetica").fontSize(10).fillColor("#475569").text("Laporan Karyawan", left, 54);
    doc.fontSize(8).text(`Dibuat: ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date())}`, 620, 38, { width: 190, align: "right" });
    doc.fontSize(8).text(filterParts, left, 72, { width: contentWidth });
  };
  const drawTableHeader = (y: number) => {
    let x = left;
    doc.fillColor("#0f766e").rect(left, y, contentWidth, 22).fill();
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff");
    for (const column of columns) {
      doc.text(column.title, x + 4, y + 7, { width: column.width - 8, align: column.key === "no" ? "center" : "left", lineBreak: false });
      x += column.width;
    }
    return y + 22;
  };
  const drawFooter = () => {
    doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(`Total ${rows.length} karyawan`, left, 560);
  };

  drawHeader();
  let y = drawTableHeader(92);
  doc.font("Helvetica").fontSize(7);
  for (const [index, row] of rows.entries()) {
    const rowValues: Record<string, string> = {
      no: String(index + 1), employee_code: safeText(row.employee_code), full_name: safeText(row.full_name),
      brand_name: safeText(row.brand_name), company_name: safeText(row.company_name), division_name: safeText(row.division_name),
      position_name: safeText(row.position_name), location_name: safeText(row.location_name), status: row.is_active ? "Aktif" : "Nonaktif",
      birth_date: safeText(row.birth_date), phone: safeText(row.phone), email: safeText(row.email),
      address_current: safeText(row.address_current), nik: safeText(row.nik), npwp: safeText(row.npwp),
      bank_name: safeText(row.bank_name), bank_account_number: safeText(row.bank_account_number),
    };
    const rowHeight = 25;
    if (y + rowHeight > 545) {
      drawFooter();
      doc.addPage();
      drawHeader();
      y = drawTableHeader(92);
    }
    if (index % 2 === 0) doc.fillColor("#f8fafc").rect(left, y, contentWidth, rowHeight).fill();
    let x = left;
    doc.fillColor("#1e293b");
    for (const column of columns) {
      doc.text(rowValues[column.key], x + 4, y + 8, { width: column.width - 8, align: column.key === "no" ? "center" : "left", lineBreak: false, ellipsis: true });
      x += column.width;
    }
    doc.strokeColor("#e2e8f0").moveTo(left, y + rowHeight).lineTo(left + contentWidth, y + rowHeight).stroke();
    y += rowHeight;
  }
  drawFooter();
  doc.end();
  return buffer;
}

export async function GET(request: Request) {
  const actor = await requirePermission(PERMISSIONS.reportExport);
  const filters = getFilters(request);
  const access = {
    includePrivate: hasPermission(actor, PERMISSIONS.employeeViewPrivateFields),
    includeSensitive: hasPermission(actor, PERMISSIONS.employeeViewSensitive),
  };
  const [rows, brands, companies, divisions, locations] = await Promise.all([
    listEmployeeReport(actor, filters, access),
    listBrandOptions(actor),
    listCompanyOptions(actor),
    listDivisionOptions(),
    listLocations(actor),
  ]);
  const filterLabels = {
    brand: filters.brandId ? brands.find((item) => item.id === filters.brandId)?.name : undefined,
    company: filters.companyId ? companies.find((item) => item.id === filters.companyId)?.name : undefined,
    division: filters.divisionId ? divisions.find((item) => item.id === filters.divisionId)?.name : undefined,
    location: filters.locationId ? locations.find((item) => item.id === filters.locationId)?.name : undefined,
  };
  const pdf = await renderPdf(rows, filters, access, filterLabels);
  await logAudit({ userId: actor.id, action: "security.export", entityType: "employee_report", details: { format: "pdf", rowCount: rows.length, filters, includesPrivate: access.includePrivate, includesSensitive: access.includeSensitive } });
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="jojo-group-laporan-karyawan-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
