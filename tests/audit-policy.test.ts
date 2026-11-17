import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRecordAuditAction } from "../src/core/audit/policy";

test("records account security and consequential data operations", () => {
  for (const action of [
    "auth.login.success", "auth.login.failed", "auth.logout",
    "auth.password.change", "user.create", "user.deactivate",
    "user.password.reset", "user.sessions.revoke", "role.permissions.update",
    "employee.create", "employee.update", "employee.deactivate",
    "employee.import", "employee.import.failed", "letter.create",
    "contract.create", "contract.decision", "master_data.delete",
    "security.export", "security.sensitive_read",
  ]) assert.equal(shouldRecordAuditAction(action), true, action);
});

test("ignores routine browsing, filtering and unknown events", () => {
  for (const action of [
    "filter", "employee.filter", "employee.search", "employee.view",
    "report.view", "report.filter", "page.view", "navigation", "pagination",
    "security.export.preview", "", "unknown.create",
  ]) assert.equal(shouldRecordAuditAction(action), false, action);
});
