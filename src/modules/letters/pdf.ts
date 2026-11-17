import PDFDocument from "pdfkit";
import type { LetterSnapshot } from "./templates";
export async function renderLetterPdf(
  snapshot: LetterSnapshot,
  number: string,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 54,
    info: {
      Title: snapshot.title,
      Author: snapshot.company,
      CreationDate: new Date(`${snapshot.date}T00:00:00Z`),
      ModDate: new Date(`${snapshot.date}T00:00:00Z`),
    },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (b: Buffer) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(snapshot.company, { align: "center" });
  doc
    .moveDown(1)
    .fontSize(13)
    .text(snapshot.title.toUpperCase(), { align: "center" });
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(`Nomor: ${number}`, { align: "center" });
  doc.moveDown(2).fontSize(11);
  for (const paragraph of snapshot.paragraphs) {
    doc.text(paragraph, { align: "justify", lineGap: 5 });
    doc.moveDown();
  }
  doc
    .moveDown()
    .text(`${snapshot.location}, ${snapshot.date}`, { align: "right" });
  doc.text(`Untuk ${snapshot.company}`, { align: "right" });
  doc.moveDown(4).text(snapshot.signatory, { align: "right" });
  doc.end();
  return result;
}
