import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contractExitDate,
  validateContractPeriod,
} from "../src/modules/contracts/policy";
import { letterCreateSchema } from "../src/modules/letters/schema";
import { contractDecisionSchema } from "../src/modules/contracts/schema";
import { hasSensitiveEmployeeChanges } from "../src/modules/employees/sensitive";

test("non-renewal preserves employment through the inclusive last day and uses the contract end as exit date", () => {
  assert.throws(() => contractExitDate("2026-11-30", "2026-11-23"));
  assert.throws(() => contractExitDate("2026-11-30", "2026-11-30"));
  assert.equal(contractExitDate("2026-11-30", "2026-12-05"), "2026-11-30");
  assert.throws(() => contractExitDate(null, "2026-12-05"));
});
test("renewals start the next day, including leap year boundaries, and require reminder dates for fixed-term contracts", () => {
  assert.doesNotThrow(() =>
    validateContractPeriod("2028-02-29", "2028-03-31", false, "2028-02-28"),
  );
  assert.throws(() =>
    validateContractPeriod("2028-03-01", "2028-03-31", false, "2028-02-28"),
  );
  assert.throws(() => validateContractPeriod("2026-12-01", null, false));
  assert.throws(() =>
    validateContractPeriod("2026-12-01", "2026-11-30", false),
  );
  assert.throws(() => validateContractPeriod("2026-12-01", "2027-01-01", true));
  assert.throws(() => validateContractPeriod("2026-12-01", null, true, null));
  assert.doesNotThrow(() =>
    validateContractPeriod("2026-12-01", null, true, "2026-11-30"),
  );
});
test("contract letters require tracked contract information and reject conflicting or unrelated ids", () => {
  const letter = {
    employeeId: 1,
    type: "CONTRACT",
    startDate: "2026-12-01",
    endDate: "2027-01-31",
    salary: 4000000,
    issuedDate: "2026-11-20",
    signatory: "HR",
    terms: "Disepakati",
  };
  assert.equal(letterCreateSchema.safeParse(letter).success, false);
  assert.equal(
    letterCreateSchema.safeParse({ ...letter, contractTypeId: 1 }).success,
    true,
  );
  assert.equal(
    letterCreateSchema.safeParse({
      ...letter,
      contractTypeId: 1,
      previousContractId: 2,
    }).success,
    true,
  );
  assert.equal(
    letterCreateSchema.safeParse({ ...letter, contractId: 1 }).success,
    true,
  );
  assert.equal(
    letterCreateSchema.safeParse({
      ...letter,
      contractId: 1,
      previousContractId: 2,
    }).success,
    false,
  );
  assert.equal(
    letterCreateSchema.safeParse({
      ...letter,
      type: "NDA",
      previousContractId: 2,
    }).success,
    false,
  );
});
test("non-extension decision does not require fields belonging only to extension", () => {
  assert.equal(
    contractDecisionSchema.safeParse({
      contractId: 1,
      decision: "NOT_EXTEND",
      exitReasonId: 1,
    }).success,
    true,
  );
  assert.equal(
    contractDecisionSchema.safeParse({ contractId: 1, decision: "NOT_EXTEND" })
      .success,
    false,
  );
});
test("crafted NIK and KTP changes count as sensitive while ordinary personal changes do not", () => {
  const form = new FormData();
  form.set("fullName", "Nama baru");
  form.set("nik", " ");
  assert.equal(hasSensitiveEmployeeChanges(form), false);
  form.set("nik", "1234567890123456");
  assert.equal(hasSensitiveEmployeeChanges(form), true);
  form.delete("nik");
  form.set("ktpPhoto", new File(["image"], "ktp.png"));
  assert.equal(hasSensitiveEmployeeChanges(form), true);
  form.delete("ktpPhoto");
  form.set("bankName", "");
  assert.equal(hasSensitiveEmployeeChanges(form), true);
});

test("renewal composer submits the predecessor and requires an end date for the new reminder", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: Composer } =
    await import("../src/app/(hr)/letters/letter-composer");
  const html = renderToStaticMarkup(
    createElement(Composer, {
      employees: [{ id: 1, full_name: "Dummy", employee_code: "EMP-1" }],
      employeeId: 1,
      contractId: 0,
      previousContractId: 9,
      contractTypeId: 1,
      contractTypes: [{ id: 1, name: "PKWT", is_permanent: false }],
      defaults: { startDate: "2026-12-01", endDate: "", salary: "4000000" },
      type: "CONTRACT",
      date: "2026-11-20",
      signatory: "HR",
      action: async () => {},
    }),
  );
  assert.match(html, /name="previousContractId"[^>]*value="9"/);
  assert.match(
    html,
    /<input(?=[^>]*name="employeeId")(?=[^>]*type="hidden")(?=[^>]*value="1")[^>]*>/,
  );
  assert.match(html, /<input(?=[^>]*name="endDate")(?=[^>]*required="")[^>]*>/);
  assert.match(html, /name="contractTypeId"/);
  assert.match(html, /H-30/);
});
