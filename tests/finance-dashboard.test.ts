import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  financeFilters,
  financeFilterQuery,
  financeWhere,
  canViewFinanceDirectory,
} from "../src/modules/dashboard/finance";
import FinanceDirectory from "../src/app/(hr)/dashboard/finance-directory";
import type { SessionUser } from "../src/types/database";
const user = {
  id: 1,
  name: "Finance",
  email: "dummy@example.test",
  roleId: 2,
  roleName: "Finance",
  scopeAll: false,
  sessionVersion: 0,
  brandIds: [1],
  permissions: ["dashboard.view", "report.view"],
} satisfies SessionUser;
test("finance defaults to active employees and normalizes only safe dashboard filters", () => {
  assert.equal(financeFilters({}).status, "active");
  assert.deepEqual(
    financeFilters({
      financeStatus: "bad",
      financeBrand: "1 OR 1=1",
      financeCompany: ["2"],
      financeSearch: "  Rizky   Wahyu ",
    }),
    {
      search: "Rizky Wahyu",
      status: "active",
      missingCompany: false,
      brandId: undefined,
      companyId: undefined,
    },
  );
  assert.equal(
    financeFilters({ financeStatus: "all", financeCompany: "missing" })
      .missingCompany,
    true,
  );
});
test("finance filters cannot broaden brand scope or search hidden phone fields", () => {
  const f = financeFilters({ financeBrand: "2", financeSearch: "%_" });
  const scope = financeWhere(user, f);
  assert.match(scope.clause, /e.brand_id IN/);
  assert.match(scope.clause, /e.brand_id = \?/);
  assert.deepEqual(scope.params, [1, true, 2, "\\%\\_%", "\\%\\_%"]);
  assert.doesNotMatch(scope.clause, /phone|nik|bank/);
  assert.equal(
    canViewFinanceDirectory({ ...user, permissions: ["dashboard.view"] }),
    false,
  );
  assert.match(
    financeWhere({ ...user, permissions: ["dashboard.view"] }, f).clause,
    /1 = 0/,
  );
  assert.match(financeWhere({ ...user, brandIds: [] }, f).clause, /1 = 0/);
});
test("finance pagination retains the missing-company and status filters", () => {
  const q = financeFilterQuery(
    financeFilters({
      financeStatus: "inactive",
      financeBrand: "1",
      financeCompany: "missing",
      financeSearch: "EMP",
    }),
  );
  assert.deepEqual(q, {
    financeSearch: "EMP",
    financeBrand: "1",
    financeCompany: "missing",
    financeStatus: "inactive",
  });
  assert.match(
    financeWhere(user, financeFilters({ financeCompany: "missing" })).clause,
    /e.company_id IS NULL/,
  );
});
test("finance directory renders CV and brand with mobile labels, and report-only access has no profile link", () => {
  const html = renderToStaticMarkup(
    createElement(FinanceDirectory, {
      result: {
        rows: [
          {
            id: 1,
            employee_code: "EMP-1",
            full_name: "Dummy Employee",
            company_name: "CV Dummy",
            brand_name: "JOJO",
            is_active: 1,
          },
        ],
        total: 1,
        page: 1,
      },
      filters: financeFilters({}),
      brands: [],
      companies: [],
      canOpenEmployee: false,
    }),
  );
  assert.match(html, /CV Dummy/);
  assert.match(html, /JOJO/);
  assert.match(html, /Dummy Employee/);
  assert.match(html, /mobile-cell-label/);
  assert.doesNotMatch(html, /href="\/employees\/1"/);
  const missing = renderToStaticMarkup(
    createElement(FinanceDirectory, {
      result: {
        rows: [
          {
            id: 1,
            employee_code: "EMP-1",
            full_name: "Dummy Employee",
            company_name: null,
            brand_name: "JOJO",
            is_active: 1,
          },
        ],
        total: 1,
        page: 1,
      },
      filters: financeFilters({}),
      brands: [],
      companies: [],
      canOpenEmployee: true,
    }),
  );
  assert.match(missing, /CV belum ditentukan/);
  assert.match(missing, /href="\/employees\/1"/);
});
