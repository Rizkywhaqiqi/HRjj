import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { reportColumns, projectReportRow, type ReportAccess } from "./access";
export async function renderEmployeeReportPdf(
  rows: Record<string, unknown>[],
  access: ReportAccess,
  filterDescription: string,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    bufferPages: true,
    info: { Title: "Laporan karyawan", Author: "JOJO HR Space" },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (b: Buffer) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const width = doc.page.width - 84;
  const bottom = doc.page.height - 52;
  let currentEmployee = "";
  const header = () => {
    const logo = join(process.cwd(), "public", "images", "jojo-logo.jpg");
    if (existsSync(logo)) doc.image(logo, 42, 31, { fit: [36, 48] });
    doc
      .fillColor("#176b58")
      .font("Helvetica-Bold")
      .fontSize(15)
      .text("JOJO HR SPACE", 92, 35, { lineBreak: false });
    doc
      .fillColor("#0f172a")
      .fontSize(11)
      .text("Laporan data karyawan", 92, 58, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        `${rows.length} karyawan | Data dasar${access.includePrivate ? " + pribadi" : ""}${access.includeSensitive ? " + sensitif" : ""}`,
        42,
        77,
        { lineBreak: false },
      );
    doc.y = 95;
  };
  const lines = (text: string) => {
    const output: string[] = [];
    let line = "";
    for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
      let part = word;
      while (doc.widthOfString(part) > width) {
        let cut = part.length;
        while (cut > 1 && doc.widthOfString(part.slice(0, cut)) > width) cut--;
        if (line) {
          output.push(line);
          line = "";
        }
        output.push(part.slice(0, cut));
        part = part.slice(cut);
      }
      const next = line ? `${line} ${part}` : part;
      if (doc.widthOfString(next) > width) {
        output.push(line);
        line = part;
      } else line = next;
    }
    if (line) output.push(line);
    return output;
  };
  const write = (text: string, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9);
    for (const line of lines(text)) {
      if (doc.y + 15 > bottom) {
        doc.addPage();
        header();
        if (currentEmployee) {
          doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor("#64748b")
            .text(`Lanjutan: ${currentEmployee}`, 42, doc.y, {
              lineBreak: false,
            });
          doc.y += 17;
        }
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9);
      }
      const y = doc.y;
      doc.fillColor("#0f172a").text(line, 42, y, { lineBreak: false });
      doc.y = y + 15;
    }
  };
  header();
  write(`Filter: ${filterDescription}`);
  doc.y += 8;
  const columns = reportColumns(access);
  rows.forEach((row, index) => {
    const data = projectReportRow(row, access);
    currentEmployee = `${data.employee_code} - ${data.full_name}`;
    if (doc.y + 50 > bottom) {
      doc.addPage();
      header();
    }
    write(`${index + 1}. ${currentEmployee}`, true);
    doc.y += 3;
    for (const column of columns) {
      if (column.key === "employee_code" || column.key === "full_name")
        continue;
      write(`${column.label}: ${data[column.key] || "Belum diisi"}`);
    }
    doc.y += 12;
  });
  if (!rows.length) write("Tidak ada data karyawan yang sesuai filter.");
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        `JOJO HR Space | Halaman ${i + 1} dari ${range.count}`,
        42,
        doc.page.height - 30,
        { lineBreak: false },
      );
  }
  doc.end();
  return result;
}
