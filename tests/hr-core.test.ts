import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSnapshot,
  parseSnapshot,
  LETTER_LABELS,
  type LetterType,
} from "../src/modules/letters/templates";
import { renderLetterPdf } from "../src/modules/letters/pdf";
import { letterCreateSchema } from "../src/modules/letters/schema";
import { resolveOrganizationName } from "../src/modules/employees/import-format";
import { contractReminder } from "../src/modules/contracts/reminders";
const input = {
  fullName: "Karyawan Dummy",
  employeeCode: "EMP-001",
  company: "Perusahaan Dummy",
  position: "Staff",
  location: "Pontianak",
  issuedDate: "2026-11-17",
  joinDate: "2026-01-01",
  startDate: "2026-11-17",
  endDate: "2027-11-16",
  salary: "4.000.000",
  purpose: "Administrasi",
  warningLevel: "SP1",
  incident: "Kejadian dummy",
  terms: "Ketentuan dummy yang disepakati",
  signatory: "HR Dummy",
};
for (const type of Object.keys(LETTER_LABELS) as LetterType[])
  test(`${type}: snapshot keeps original data and produces a PDF on demand`, async () => {
    const source = { ...input, type };
    const snapshot = createSnapshot(source);
    const stored = JSON.stringify({ snapshot });
    source.fullName = "Nama baru";
    source.position = "Supervisor";
    const parsed = parseSnapshot(stored)!;
    assert.equal(parsed.employeeName, "Karyawan Dummy");
    assert.equal(parsed.position, "Staff");
    assert.equal(parsed.template, type);
    const first = await renderLetterPdf(parsed, "BR/CV1/TEST/2026/0001");
    const again = await renderLetterPdf(parsed, "BR/CV1/TEST/2026/0001");
    assert.equal(first.subarray(0, 5).toString(), "%PDF-");
    assert.deepEqual(first, again);
  });
test("legacy metadata and unknown template versions cannot impersonate a snapshot", () => {
  assert.equal(parseSnapshot({ employee_name: "Current" }), null);
  assert.equal(
    parseSnapshot({
      snapshot: { ...createSnapshot({ ...input, type: "SKK" }), version: 2 },
    }),
    null,
  );
});
test("letter-specific required data is validated", () => {
  const base = {
    employeeId: 1,
    type: "NDA",
    issuedDate: "2026-11-17",
    signatory: "HR Dummy",
    startDate: "2026-11-17",
    terms: "",
  };
  assert.equal(letterCreateSchema.safeParse(base).success, false);
  assert.equal(
    letterCreateSchema.safeParse({ ...base, terms: "Ketentuan" }).success,
    true,
  );
  assert.equal(
    letterCreateSchema.safeParse({ ...base, type: "SP", incident: "Kejadian" })
      .success,
    false,
  );
});
test("organization mapping refuses ambiguous names", () => {
  assert.equal(
    resolveOrganizationName(
      " outlet satu ",
      [{ id: 1, name: "Outlet Satu" }],
      "Lokasi",
    ),
    1,
  );
  assert.throws(() =>
    resolveOrganizationName(
      "Outlet",
      [
        { id: 1, name: "Outlet" },
        { id: 2, name: "Outlet" },
      ],
      "Lokasi",
    ),
  );
  assert.throws(() => resolveOrganizationName("Missing", [], "Lokasi"));
});
test("contract reminder boundaries include overdue, H7, and H30", () => {
  assert.equal(contractReminder(-1).tone, "danger");
  assert.equal(contractReminder(0).tone, "danger");
  assert.equal(contractReminder(7).tone, "danger");
  assert.equal(contractReminder(8).tone, "warning");
  assert.equal(contractReminder(30).tone, "warning");
  assert.equal(contractReminder(31).tone, "neutral");
  assert.equal(contractReminder(null).label, "Tanpa tanggal akhir");
});
