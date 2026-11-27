import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import { employeeSearch } from "../src/modules/employees/search";
import { nextContractDate } from "../src/modules/contracts/date";
import { renderEmployeeReportPdf } from "../src/modules/reports/pdf";

test("signed but potentially revoked cookies can reach login for database validation", async () => {
  process.env.AUTH_SECRET = "test-only-session-secret-with-more-than-32-characters";
  const jwt = await new SignJWT({ sv: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject("1").setIssuer("jojohrspace").setAudience("hr-internal").setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const response = await proxy(new NextRequest("https://example.test/login", { headers: { cookie: `hr_session=${jwt}` } }));
  assert.equal(response.headers.get("location"), null);
  const anonymous = await proxy(new NextRequest("https://example.test/dashboard"));
  assert.equal(new URL(anonymous.headers.get("location")!).pathname, "/login");
});
test("search normalizes whitespace and treats SQL wildcards literally", () => {
  assert.deepEqual(employeeSearch("  Rizky   Wahyu ").params, ["Rizky Wahyu%", "Rizky Wahyu%"]);
  assert.equal(employeeSearch("%_").params[0], "\\%\\_%");
  assert.equal(employeeSearch("R").clause, "1 = 0");
  assert.equal(employeeSearch("").clause, "1 = 1");
});
test("contract extensions handle month/year and leap-day boundaries", () => {
  assert.equal(nextContractDate("2026-11-30"), "2026-12-01");
  assert.equal(nextContractDate("2026-12-31"), "2027-01-01");
  assert.equal(nextContractDate("2028-02-28"), "2028-02-29");
});
test("PDF accepts rows arriving asynchronously in batches", async () => {
  async function* rows() { yield { employee_code: "EMP-1", full_name: "Test Employee", is_active: 1 }; }
  const pdf = await renderEmployeeReportPdf(rows(), { includePrivate: false, includeSensitive: false }, "Semua", 1);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 1000);
});

test("PDF streams a multi-page export without accumulating output buffers", async () => {
  const { PassThrough } = await import("node:stream");
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  const consume = (async () => { for await (const chunk of output) chunks.push(chunk); })();
  async function* rows() { for (let i = 0; i < 120; i++) yield { employee_code: `EMP-${i}`, full_name: "Test Employee", is_active: 1 }; }
  const result = await renderEmployeeReportPdf(rows(), { includePrivate: false, includeSensitive: false }, "Semua", 120, output);
  await consume;
  assert.equal(result.length, 0);
  assert.equal(Buffer.concat(chunks).subarray(0, 4).toString(), "%PDF");
  assert.ok(Buffer.concat(chunks).length > 10000);
});
