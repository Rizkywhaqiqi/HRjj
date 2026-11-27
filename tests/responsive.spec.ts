import { expect, test } from "@playwright/test";

const screens = [
  "dashboard",
  "finance",
  "contracts",
  "reports",
  "letters",
  "audit",
];
const sizes = [
  [320, 740],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [667, 375],
];
for (const screen of screens) {
  test(`${screen}: narrow and wide panes contain content and preserve table labels`, async ({
    page,
  }) => {
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.goto(`/responsive-check/${screen}`);
      await page.waitForFunction(
        () => document.documentElement.dataset.fixtureReady === "true",
      );
      await expect(page.locator("main table")).toBeVisible();
      if (width === 390)
        await page.screenshot({
          path: `test-results/${screen}-mobile.png`,
          fullPage: true,
        });
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        pane: document
          .querySelector(".responsive-table-wrap")!
          .getBoundingClientRect().width,
        table: getComputedStyle(document.querySelector("main table")!).display,
      }));
      expect(
        dimensions.document,
        `${screen} overflow at ${width}x${height}`,
      ).toBeLessThanOrEqual(width + 1);
      if (dimensions.pane < 767) {
        expect(dimensions.table).toBe("block");
        await expect(page.locator(".mobile-cell-label").first()).toBeVisible();
      } else {
        expect(dimensions.table).toBe("table");
        await expect(page.locator(".mobile-cell-label").first()).toBeHidden();
      }
    }
  });
}
test("mobile navigation closes on Escape, route selection and desktop resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/responsive-check/contracts");
  const trigger = page.getByRole("button", { name: "Buka menu navigasi" });
  const dialog = page.getByRole("dialog");
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "Karyawan", exact: true }).click();
  await expect(dialog).toBeHidden();
  await trigger.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 667, height: 375 });
  await trigger.click();
  await expect(
    dialog.getByRole("button", { name: "Tutup menu" }),
  ).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "Keluar", exact: true }),
  ).toBeInViewport();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("login sends security headers and remains usable", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(response?.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'self'",
  );
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.getByRole("heading", { name: "Masuk ke akun staf internal" }),
  ).toBeVisible();
});
test("contract submit is disabled while a server action is pending", async ({
  page,
}) => {
  await page.goto("/responsive-check/contracts");
  const form = page.locator('form:has(select[name="contractTypeId"])');
  await form.locator('[name="employeeId"]').selectOption("1");
  await form.locator('[name="contractTypeId"]').selectOption("1");
  await form.locator('[name="startDate"]').fill("2026-12-01");
  await form.locator('[name="endDate"]').fill("2027-01-31");
  const submit = form.locator('button[type="submit"]');
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(submit).toBeEnabled();
});

test("finance CV options follow the selected brand", async ({ page }) => {
  await page.goto("/responsive-check/dashboard");
  const section = page.getByRole("region", {
    name: "Data karyawan untuk keuangan",
  });
  await expect(section).toBeVisible();
  await section.locator('[name="financeBrand"]').selectOption("1");
  await expect(
    section.locator('[name="financeCompany"] option[value="1"]'),
  ).toHaveCount(1);
  await expect(
    section.locator('[name="financeCompany"] option[value="2"]'),
  ).toHaveCount(0);
  await expect(
    section.getByRole("columnheader", { name: "CV / perusahaan", exact: true }),
  ).toHaveCount(1);
});

test("finance workspace restricts CV options after selecting a brand", async ({
  page,
}) => {
  await page.goto("/responsive-check/finance");
  await page.waitForFunction(
    () => document.documentElement.dataset.fixtureReady === "true",
  );
  await page.getByLabel("Brand", { exact: true }).selectOption("1");
  const company = page.getByLabel("CV / perusahaan", { exact: true });
  await expect(company.locator('option[value="1"]')).toHaveCount(1);
  await expect(company.locator('option[value="2"]')).toHaveCount(0);
  await expect(
    page.getByText("Menunggu keputusan", { exact: true }).first(),
  ).toBeVisible();
});

test("finance detail keeps amounts, forms and decisions readable on mobile and desktop", async ({
  page,
}) => {
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [1024, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/responsive-check/finance-detail");
    await page.waitForFunction(
      () => document.documentElement.dataset.fixtureReady === "true",
    );
    await expect(page.locator('input[name="amount"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Setujui", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    if (width === 390)
      await page.screenshot({
        path: "test-results/finance-detail-mobile.png",
        fullPage: true,
      });
  }
});
