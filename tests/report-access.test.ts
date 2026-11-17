import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { PERMISSIONS } from "../src/core/rbac/permissions";
import {
  reportAccess,
  reportColumns,
  projectReportRow,
  safeCsvCell,
} from "../src/modules/reports/access";
import {
  reportFilters,
  reportFilterQuery,
} from "../src/modules/reports/filters";
import { renderEmployeeReportPdf } from "../src/modules/reports/pdf";
const source = {
  employee_code: "EMP-TEST",
  full_name: "Karyawan Dummy",
  brand_name: "Brand Dummy",
  company_name: "Perusahaan Dummy",
  division_name: "Divisi",
  position_name: "Staff",
  location_name: "Pontianak",
  join_date: "2026-01-01",
  is_active: 1,
  phone: "PRIVATEPHONE",
  address_current: "PRIVATEADDRESS ".repeat(80),
  children_count: 0,
  nik: "SECRETNIK",
  npwp: "SECRETNPWP",
  bank_account_number: "SECRETACCOUNT",
  ktp_uploaded: 1,
  nik_encrypted: "INTERNALCIPHER",
  ktp_photo_path: "private/ktp/INTERNALPATH.jpg",
};
const matrix = [
  { permissions: [], private: false, sensitive: false },
  {
    permissions: [PERMISSIONS.employeeViewPrivateFields],
    private: true,
    sensitive: false,
  },
  {
    permissions: [PERMISSIONS.employeeViewSensitive],
    private: false,
    sensitive: true,
  },
  {
    permissions: [
      PERMISSIONS.employeeViewPrivateFields,
      PERMISSIONS.employeeViewSensitive,
    ],
    private: true,
    sensitive: true,
  },
];
for (const entry of matrix)
  test(`report fields enforce private=${entry.private}, sensitive=${entry.sensitive}`, () => {
    const access = reportAccess(entry);
    const row = projectReportRow(source, access);
    assert.equal("phone" in row, entry.private);
    assert.equal("children_count" in row, entry.private);
    assert.equal("nik" in row, entry.sensitive);
    assert.equal("ktp_uploaded" in row, entry.sensitive);
    assert.equal("nik_encrypted" in row, false);
    assert.equal("ktp_photo_path" in row, false);
    assert.equal(row.employee_code, "EMP-TEST");
    if (entry.private) assert.equal(row.children_count, "0");
    assert.deepEqual(
      Object.keys(row),
      reportColumns(access).map((c) => c.key),
    );
  });
function pdfText(pdf: Buffer) {
  let output = "";
  const raw = pdf.toString("latin1");
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      const decoded = inflateSync(Buffer.from(m[1], "latin1")).toString(
        "latin1",
      );
      for (const hex of decoded.matchAll(/<([a-f0-9]+)>/gi))
        output += Buffer.from(hex[1], "hex").toString("latin1");
    } catch {
      /* Non-text streams are ignored. */
    }
  }
  return output;
}
for (const entry of matrix)
  test(`PDF content respects access private=${entry.private}, sensitive=${entry.sensitive}`, async () => {
    const pdf = await renderEmployeeReportPdf(
      [source],
      reportAccess(entry),
      "Data dummy",
    );
    const text = pdfText(pdf);
    assert.ok(text.includes("EMP-TEST"));
    assert.equal(text.includes("PRIVATEPHONE"), entry.private);
    assert.equal(text.includes("SECRETNIK"), entry.sensitive);
    assert.ok(!text.includes("INTERNALCIPHER"));
    assert.ok(!text.includes("INTERNALPATH"));
  });
test("export filters exclude screen page navigation", () => {
  const f = reportFilters(
    new URLSearchParams(
      "page=7&status=active&brand=2&company=3&division=4&location=5&search=Dummy&incomplete=1&includeSensitive=true",
    ),
  );
  const q = reportFilterQuery(f);
  assert.equal(q.brand, "2");
  assert.equal(q.incomplete, "1");
  assert.equal(q.status, "active");
  assert.equal("page" in q, false);
  assert.equal("includeSensitive" in q, false);
});
test("CSV cells cannot become spreadsheet formulas", () => {
  for (const value of ["=SUM(A1)", "+cmd", "-cmd", "@cmd", "  =cmd"]) {
    assert.ok(safeCsvCell(value).startsWith("\"'"));
  }
  assert.equal(safeCsvCell('teks "biasa"'), '"teks ""biasa"""');
});
