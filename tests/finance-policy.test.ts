import { test } from "node:test";
import assert from "node:assert/strict";
import {
  salaryRequestSchema,
  assertSalaryDecision,
  financePeriod,
  jakartaToday,
} from "../src/modules/finance/policy";
import { employeeSearch } from "../src/modules/employees/search";
test("salary decisions prevent self approval, double decisions, and another user cancelling", () => {
  const pending = { status: "PENDING", requested_by: 12 };
  assert.throws(() => assertSalaryDecision(pending, 12, "APPROVED"), /sendiri/);
  assert.throws(() => assertSalaryDecision(pending, 12, "REJECTED"), /sendiri/);
  assert.throws(
    () => assertSalaryDecision(pending, 13, "CANCELLED"),
    /pengaju/,
  );
  assert.doesNotThrow(() => assertSalaryDecision(pending, 13, "APPROVED"));
  assert.doesNotThrow(() => assertSalaryDecision(pending, 12, "CANCELLED"));
  assert.throws(
    () =>
      assertSalaryDecision(
        { status: "APPROVED", requested_by: 12 },
        13,
        "APPROVED",
      ),
    /diproses/,
  );
});
test("salary inputs preserve decimal precision and reject separators, negatives and exponential amounts", () => {
  const base = {
    employeeId: "1",
    effectiveDate: "2026-11-01",
    reason: "Penyesuaian gaji tahunan",
  };
  for (const amount of ["1900000", "1900000.25", "0"])
    assert.equal(
      salaryRequestSchema.safeParse({ ...base, amount }).success,
      true,
    );
  for (const amount of [
    "1.900.000",
    "1,900,000",
    "-100",
    "1e6",
    "Infinity",
    "1000000000001",
    "1900000.123",
  ])
    assert.equal(
      salaryRequestSchema.safeParse({ ...base, amount }).success,
      false,
      amount,
    );
  assert.equal(
    salaryRequestSchema.safeParse({
      ...base,
      amount: "10",
      effectiveDate: "2026-02-30",
    }).success,
    false,
  );
});
test("period validation handles leap years and Jakarta day boundaries", () => {
  assert.equal(financePeriod("2028-02").end, "2028-02-29");
  assert.equal(financePeriod("2026-02").end, "2026-02-28");
  assert.equal(financePeriod("2026-13").month, jakartaToday().slice(0, 7));
  assert.equal(jakartaToday(new Date("2026-11-27T18:00:00Z")), "2026-11-28");
});
test("normal search does not allow inference of hidden employee phone numbers", () => {
  assert.doesNotMatch(employeeSearch("08123").clause, /phone/);
  assert.match(employeeSearch("08123", true).clause, /phone/);
});
