import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requirePermission, requireFeatureEnabled } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { importReferences } from "@/modules/employees/import-references";
import {
  EMPLOYEE_IMPORT_COLUMNS,
  EMPLOYEE_IMPORT_VERSION,
} from "@/modules/employees/import-format";
export async function GET() {
  const actor = await requirePermission(PERMISSIONS.employeeCreate);
  await requireFeatureEnabled("employees");
  const refs = await importReferences(actor);
  const w = new ExcelJS.Workbook();
  const data = w.addWorksheet("Karyawan");
  data.addRow([...EMPLOYEE_IMPORT_COLUMNS]);
  data.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  data.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF176B58" },
  };
  data.views = [{ state: "frozen", ySplit: 1 }];
  data.columns.forEach((c) => {
    c.width = 24;
    c.numFmt = "@";
  });
  const help = w.addWorksheet("Petunjuk");
  help.addRows([
    ["Format", EMPLOYEE_IMPORT_VERSION],
    [
      "Wajib",
      "fullName, positionName, locationName, dan salah satu brandName/companyName",
    ],
    [
      "Kode karyawan",
      "Isi employeeCode yang tetap dan unik pada ekspor recruitment agar import ulang ditolak, bukan menggandakan data.",
    ],
    [
      "NIK dan telepon",
      "Teks, bukan angka Excel. Jangan hilangkan angka nol di depan.",
    ],
    ["Tanggal", "YYYY-MM-DD atau tanggal Excel. Status awal karyawan aktif."],
    [
      "Nama organisasi",
      "Harus sama persis dengan sheet Referensi. ID lama tetap didukung.",
    ],
    [
      "Privasi",
      "File tidak memuat KTP/CV. Unggah KTP melalui profil karyawan.",
    ],
    [
      "Versi",
      "Aplikasi recruitment terpisah mengekspor sheet Karyawan dengan header yang sama.",
    ],
    [
      "Proses",
      "Pilih file, periksa, lalu simpan. Tidak ada data lama yang ditimpa.",
    ],
  ]);
  help.getColumn(1).width = 24;
  help.getColumn(2).width = 110;
  const ref = w.addWorksheet("Referensi");
  ref.addRow(["Jenis", "ID", "Nama", "ID induk"]);
  for (const [kind, values] of Object.entries(refs))
    for (const v of values) ref.addRow([kind, v.id, v.name, v.parentId ?? ""]);
  ref.columns.forEach((c) => (c.width = 30));
  return new NextResponse(new Uint8Array(await w.xlsx.writeBuffer()), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${EMPLOYEE_IMPORT_VERSION}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
