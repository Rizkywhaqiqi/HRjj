import { test } from "node:test";
import assert from "node:assert/strict";
import { assertDelegatedAccess } from "../src/core/rbac/delegation";
import type { SessionUser } from "../src/types/database";
import { passwordSchema } from "../src/core/auth/password";
import { sanitizeNextPath } from "../src/core/http/navigation";
import {
  htmlCsp,
  securityHeaders,
  privateHeaders,
} from "../src/core/http/security-headers";
import { isSameOriginMutation } from "../src/core/http/origin";
import { sessionArray } from "../src/core/auth/session-values";
import { directBrandScope, brandScope } from "../src/core/rbac/scope";
const actor = {
  id: 1,
  name: "Manager",
  email: "dummy@example.test",
  roleId: 2,
  roleName: "Manager",
  scopeAll: false,
  sessionVersion: 0,
  brandIds: [1],
  permissions: ["user.manage", "employee.view"],
} satisfies SessionUser;
test("delegated managers cannot grant or manage elevated roles or other brand scopes", () => {
  const basic = {
    roleName: "Staff",
    permissions: ["employee.view"],
    scopeAll: false,
    brandIds: [1],
  };
  assert.doesNotThrow(() => assertDelegatedAccess(actor, basic));
  assert.throws(() =>
    assertDelegatedAccess(actor, { ...basic, roleName: "Super Admin" }),
  );
  assert.throws(() =>
    assertDelegatedAccess(actor, {
      ...basic,
      permissions: ["employee.view_sensitive"],
    }),
  );
  assert.throws(() =>
    assertDelegatedAccess(actor, { ...basic, scopeAll: true }),
  );
  assert.throws(() =>
    assertDelegatedAccess(actor, { ...basic, brandIds: [2] }),
  );
  assert.doesNotThrow(() =>
    assertDelegatedAccess(
      { ...actor, roleName: "Super Admin", scopeAll: true },
      {
        ...basic,
        roleName: "Super Admin",
        scopeAll: true,
        permissions: ["role.manage"],
        brandIds: [2],
      },
    ),
  );
});
test("bcrypt accepts at most 72 UTF-8 bytes, including Unicode passwords", () => {
  assert.equal(passwordSchema.safeParse("a".repeat(72)).success, true);
  assert.equal(passwordSchema.safeParse("😀".repeat(18)).success, true);
  assert.equal(passwordSchema.safeParse("😀".repeat(19)).success, false);
  assert.equal(passwordSchema.safeParse("a".repeat(73)).success, false);
});
test("redirect targets reject control-character and authority normalization tricks", () => {
  for (const next of [
    "//evil.test",
    "/\n/evil.test",
    "/\t/evil.test",
    "/\\evil.test",
    "https://evil.test",
  ])
    assert.equal(sanitizeNextPath(next), "/dashboard");
  assert.equal(sanitizeNextPath("/employees?page=2"), "/employees?page=2");
});
test("import origin protection rejects same-site sibling origins and null origins", () => {
  const make = (origin?: string, site?: string) =>
    new Request("https://hr.example.test/api/employees/import", {
      method: "POST",
      headers: {
        ...(origin ? { origin } : {}),
        ...(site ? { "sec-fetch-site": site } : {}),
      },
    });
  assert.equal(isSameOriginMutation(make("https://hr.example.test")), true);
  assert.equal(isSameOriginMutation(make("https://evil.example.test")), false);
  assert.equal(isSameOriginMutation(make("null")), false);
  assert.equal(isSameOriginMutation(make(undefined, "cross-site")), false);
  assert.equal(isSameOriginMutation(make()), true);
});
test("CSP permits own-origin PDF frames and omits unsafe-eval in production", () => {
  assert.match(htmlCsp(true), /frame-src 'self'/);
  assert.match(htmlCsp(true), /frame-ancestors 'self'/);
  assert.match(htmlCsp(true), /object-src 'none'/);
  assert.doesNotMatch(htmlCsp(true), /unsafe-eval/);
  assert.ok(
    securityHeaders(true).some((h) => h.key === "Strict-Transport-Security"),
  );
  assert.ok(privateHeaders.every((h) => h.value.includes("no-store")));
});
test("JSON session permissions preserve long lists without GROUP_CONCAT truncation", () => {
  const codes = Array.from(
    { length: 150 },
    (_, i) => `permission.long_name_${i}`,
  );
  assert.deepEqual(sessionArray(JSON.stringify(codes)), codes);
  assert.deepEqual(sessionArray(codes), codes);
  assert.deepEqual(sessionArray("invalid"), []);
  assert.deepEqual(sessionArray({}), []);
});
test("brand SQL scopes deny empty access and parameterize caller-visible brand ids", () => {
  assert.equal(
    directBrandScope({ ...actor, brandIds: [] }, "e.brand_id").clause,
    "1 = 0",
  );
  assert.deepEqual(directBrandScope(actor, "e.brand_id").params, [1]);
  assert.deepEqual(brandScope(actor, "co.id").params, [1]);
  assert.throws(() => directBrandScope(actor, "e.brand_id;DELETE FROM users"));
});
