import { readFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

function paragraph(
  text: string,
  options: { align?: "left" | "center" | "right"; bold?: boolean; size?: number; after?: number } = {},
): string {
  const paragraphProperties = [
    options.align ? `<w:jc w:val="${options.align}"/>` : "",
    `<w:spacing w:after="${options.after ?? 60}"/>`,
  ].filter(Boolean).join("");
  const runProperties = [
    '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>',
    options.bold ? "<w:b/>" : "",
    `<w:sz w:val="${options.size ?? 20}"/>`,
  ].filter(Boolean).join("");

  return `<w:p><w:pPr>${paragraphProperties}</w:pPr><w:r><w:rPr>${runProperties}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function logoParagraph(): string {
  const width = 1_828_800;
  const height = 960_000;
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="JOJO Group logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="jojo-logo.jpg"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:srcRect l="4688" t="27735" r="3906" b="24219"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

export function createBuiltInOfferLetterTemplate(): Buffer {
  const zip = new PizZip();
  const logo = readFileSync(
    path.join(process.cwd(), "public", "images", "jojo-logo.jpg"),
  );
  zip.file("word/media/jojo-logo.jpg", logo);
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="jpg" ContentType="image/jpeg"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>",
  );
  zip.folder("_rels")?.file(
    ".rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>",
  );
  zip.folder("word")?.folder("_rels")?.file(
    "document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/jojo-logo.jpg"/>' +
      "</Relationships>",
  );

  const paragraphs = [
    logoParagraph(),
    paragraph("{company_name}", { align: "center", bold: true, size: 30, after: 40 }),
    paragraph("{company_address}", { align: "center", size: 18, after: 20 }),
    paragraph("Telepon: {company_phone}", { align: "center", size: 18, after: 220 }),
    paragraph("{location_city}, {issued_date}", { align: "right", after: 180 }),
    paragraph("Kepada Yth."),
    paragraph("Sdr/i {full_name}", { bold: true, after: 180 }),
    paragraph("SURAT PENAWARAN KERJA", { align: "center", bold: true, size: 26, after: 180 }),
    paragraph("Dengan hormat,"),
    paragraph("Melalui surat ini, {company_name} menyampaikan penawaran kerja kepada Saudara/i untuk posisi {position_name}. Rincian penawaran adalah sebagai berikut:", { after: 120 }),
    paragraph("Nama: {full_name}"),
    paragraph("Posisi: {position_name}"),
    paragraph("Lokasi kerja: {location_name}"),
    paragraph("Melapor kepada: {reporting_to}"),
    paragraph("Masa training: {training_period}"),
    paragraph("Jam kerja: {work_hours}"),
    paragraph("Jenis kontrak: {contract_type_name}"),
    paragraph("Perkiraan mulai bekerja: {offer_start_date}"),
    paragraph("Perkiraan akhir kontrak: {offer_end_date}"),
    paragraph("Gaji pokok: Rp {offered_salary}", { after: 140 }),
    paragraph("Ketentuan umum:", { bold: true, after: 60 }),
    paragraph("1. Rincian pekerjaan, kompensasi, dan masa kerja akan dituangkan dalam perjanjian kerja setelah penawaran ini diterima."),
    paragraph("2. Pelaksanaan pekerjaan mengikuti peraturan perusahaan, kebijakan yang berlaku, dan ketentuan perundang-undangan."),
    paragraph("3. Perubahan atau pengakhiran hubungan kerja dilakukan sesuai perjanjian kerja dan ketentuan yang berlaku.", { after: 140 }),
    paragraph("Apabila Saudara/i menerima penawaran ini, mohon tanda tangani bagian persetujuan dan sampaikan kembali kepada perusahaan. Penawaran ini bukan pengganti perjanjian kerja."),
    paragraph("Kami menantikan kesempatan untuk menyambut Saudara/i di tim {company_name}. Terima kasih."),
    paragraph("Hormat kami,", { after: 40 }),
    paragraph("{company_name}", { bold: true, after: 500 }),
    paragraph("____________________________"),
    paragraph("Perwakilan perusahaan", { after: 180 }),
    paragraph("Menyetujui penawaran,"),
    paragraph("{full_name}", { bold: true, after: 40 }),
    paragraph("Tanggal: ____________________"),
  ].join("");

  zip.folder("word")?.file(
    "document.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      `<w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="900" w:bottom="720" w:left="900" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body>` +
      "</w:document>",
  );

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
