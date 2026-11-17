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

function safeText(value: unknown): string {
  const text = value == null ? "" : String(value);
  return text.trim().replace(/\s+/g, " ") || "Belum diisi";
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "Belum diisi";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const date = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return safeText(raw);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

async function renderPdf(
  rows: Awaited<ReturnType<typeof listEmployeeReport>>,
  filters: EmployeeListFilters,
  access: { includePrivate: boolean; includeSensitive: boolean },
  filterLabels: { brand?: string; company?: string; division?: string; location?: string },
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "portrait", margin: 36 });
  const chunks: Buffer[] = [];
  const buffer = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = 36;
  const contentWidth = doc.page.width - left * 2;
  const pageBottom = doc.page.height - 42;
  const generatedAt = new Date();
  const generatedLabel = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(generatedAt);
  const activeCount = rows.filter((row) => row.is_active).length;
  const inactiveCount = rows.length - activeCount;
  const filterParts = [
    filters.search ? `Pencarian: ${safeText(filters.search)}` : null,
    filters.status === "active" ? "Status: Aktif" : filters.status === "inactive" ? "Status: Nonaktif" : null,
    filterLabels.brand ? `Brand: ${safeText(filterLabels.brand)}` : null,
    filterLabels.company ? `CV: ${safeText(filterLabels.company)}` : null,
    filterLabels.division ? `Divisi: ${safeText(filterLabels.division)}` : null,
    filterLabels.location ? `Lokasi: ${safeText(filterLabels.location)}` : null,
  ].filter(Boolean).join(" | ") || "Semua karyawan";

  const brandCounts = new Map<string, number>();
  for (const row of rows) brandCounts.set(safeText(row.brand_name), (brandCounts.get(safeText(row.brand_name)) ?? 0) + 1);

  let pageNumber = 0;
  const drawFooter = () => {
    doc.font("Helvetica").fontSize(6.5).fillColor("#64748b");
    doc.text(`JOJO GROUP MANAGEMENT | Sistem HR Internal | ${generatedLabel}`, left, doc.page.height - 27, { width: contentWidth - 70, height: 8, lineBreak: false, ellipsis: true });
    doc.text(`Halaman ${pageNumber}`, doc.page.width - 90, doc.page.height - 27, { width: 54, height: 8, align: "right", lineBreak: false });
  };
  const drawMainHeader = () => {
    pageNumber += 1;
    doc.fillColor("#c4ff55").rect(left, 28, 86, 4).fill();
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text("JOJO GROUP MANAGEMENT", left, 38);
    doc.font("Helvetica").fontSize(10).fillColor("#475569").text("Laporan Data Karyawan (Detail)", left, 62);
    doc.fontSize(8).text(`Dibuat: ${generatedLabel} | Total: ${rows.length} karyawan | Aktif: ${activeCount} | Nonaktif: ${inactiveCount}`, left, 80, { width: contentWidth, height: 10, lineBreak: false, ellipsis: true });
    doc.strokeColor("#cbd5e1").lineWidth(0.8).moveTo(left, 96).lineTo(left + contentWidth, 96).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text("Filter laporan", left, 108);
    doc.font("Helvetica").fontSize(8).fillColor("#475569").text(filterParts, left, 123, { width: contentWidth, height: 12, ellipsis: true });
  };
  const drawContinuationHeader = () => {
    pageNumber += 1;
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Detail Karyawan (lanjutan)", left, 32);
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(filterParts, left, 50, { width: contentWidth, height: 12, ellipsis: true });
    doc.strokeColor("#cbd5e1").lineWidth(0.8).moveTo(left, 66).lineTo(left + contentWidth, 66).stroke();
  };
  const drawBrandSummary = (y: number) => {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text("Rekap Jumlah Karyawan per Brand", left, y);
    y += 18;
    doc.fillColor("#0f766e").rect(left, y, contentWidth, 20).fill();
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff").text("Brand", left + 8, y + 6);
    doc.text("Jumlah", left + contentWidth - 70, y + 6, { width: 60, align: "right" });
    y += 20;
    for (const [brand, count] of brandCounts) {
      doc.fillColor("#f8fafc").rect(left, y, contentWidth, 18).fill();
      doc.font("Helvetica").fontSize(8).fillColor("#1e293b").text(brand, left + 8, y + 5);
      doc.text(String(count), left + contentWidth - 70, y + 5, { width: 60, align: "right" });
      doc.strokeColor("#e2e8f0").moveTo(left, y + 18).lineTo(left + contentWidth, y + 18).stroke();
      y += 18;
    }
    return y + 18;
  };
  const drawLabelValue = (label: string, value: string, x: number, y: number, width: number) => {
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748b").text(`${label}:`, x, y, { lineBreak: false });
    const labelWidth = doc.widthOfString(`${label}:`) + 4;
    doc.font("Helvetica").fontSize(8).fillColor("#1e293b").text(value, x + labelWidth, y - 1, { width: Math.max(width - labelWidth, 20), height: 12, ellipsis: true, lineBreak: false });
  };
  const drawEmployeeCard = (row: Awaited<ReturnType<typeof listEmployeeReport>>[number], index: number, y: number) => {
    const privateLines = access.includePrivate ? 4 : 0;
    const sensitiveLines = access.includeSensitive ? 2 : 0;
    const inactiveLine = row.is_active ? 0 : 1;
    const cardHeight = 88 + (privateLines + sensitiveLines + inactiveLine) * 18;
    doc.fillColor(index % 2 === 0 ? "#f8fafc" : "#ffffff").roundedRect(left, y, contentWidth, cardHeight, 6).fill();
    doc.strokeColor("#cbd5e1").lineWidth(0.7).roundedRect(left, y, contentWidth, cardHeight, 6).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(`${safeText(row.employee_code)}  ${safeText(row.full_name)}`, left + 12, y + 11, { width: contentWidth - 105, ellipsis: true });
    const status = row.is_active ? "AKTIF" : "NONAKTIF";
    const statusColor = row.is_active ? "#dcfce7" : "#fee2e2";
    const statusText = row.is_active ? "#166534" : "#991b1b";
    doc.fillColor(statusColor).roundedRect(left + contentWidth - 83, y + 9, 70, 18, 9).fill();
    doc.font("Helvetica-Bold").fontSize(7).fillColor(statusText).text(status, left + contentWidth - 83, y + 15, { width: 70, align: "center" });
    doc.strokeColor("#e2e8f0").moveTo(left + 12, y + 32).lineTo(left + contentWidth - 12, y + 32).stroke();
    const half = (contentWidth - 36) / 2;
    let lineY = y + 41;
    drawLabelValue("Brand", safeText(row.brand_name), left + 12, lineY, half);
    drawLabelValue("Jabatan", safeText(row.position_name), left + 24 + half, lineY, half);
    lineY += 18;
    drawLabelValue("Divisi", safeText(row.division_name), left + 12, lineY, half);
    drawLabelValue("Lokasi Kerja", safeText(row.location_name), left + 24 + half, lineY, half);
    lineY += 18;
    drawLabelValue("Tanggal Bergabung", formatDate(row.join_date), left + 12, lineY, half);
    drawLabelValue("CV", safeText(row.company_name), left + 24 + half, lineY, half);
    if (!row.is_active) {
      lineY += 18;
      drawLabelValue("Dinonaktifkan pada", formatDate(row.exit_date), left + 12, lineY, half);
      drawLabelValue("Status", "Nonaktif", left + 24 + half, lineY, half);
    }
    if (access.includePrivate) {
      lineY += 18;
      drawLabelValue("Tempat, tanggal lahir", `${safeText(row.birth_place)}, ${formatDate(row.birth_date)}`, left + 12, lineY, half);
      drawLabelValue("Telepon", safeText(row.phone), left + 24 + half, lineY, half);
      lineY += 18;
      drawLabelValue("Email", safeText(row.email), left + 12, lineY, half);
      drawLabelValue("Status pernikahan", safeText(row.marital_status), left + 24 + half, lineY, half);
      lineY += 18;
      drawLabelValue("Alamat saat ini", safeText(row.address_current), left + 12, lineY, contentWidth - 24);
      lineY += 18;
      drawLabelValue("Alamat KTP", safeText(row.address_ktp), left + 12, lineY, contentWidth - 24);
    }
    if (access.includeSensitive) {
      lineY += 18;
      drawLabelValue("NIK", safeText(row.nik), left + 12, lineY, half);
      drawLabelValue("NPWP", safeText(row.npwp), left + 24 + half, lineY, half);
      lineY += 18;
      drawLabelValue("Bank", safeText(row.bank_name), left + 12, lineY, half);
      drawLabelValue("Nomor rekening", safeText(row.bank_account_number), left + 24 + half, lineY, half);
    }
    return cardHeight;
  };

  drawMainHeader();
  let y = drawBrandSummary(145);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text("Detail Karyawan", left, y);
  y += 18;
  for (const [index, row] of rows.entries()) {
    const cardHeight = 88 + (access.includePrivate ? 4 : 0) * 18 + (access.includeSensitive ? 2 : 0) * 18 + (row.is_active ? 0 : 1) * 18;
    if (y + cardHeight > pageBottom) {
      drawFooter();
      doc.addPage();
      drawContinuationHeader();
      y = 82;
    }
    y += drawEmployeeCard(row, index, y) + 10;
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
