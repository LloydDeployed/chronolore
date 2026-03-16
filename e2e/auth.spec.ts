import { test, expect } from "@playwright/test";
import { uniqueId } from "./helpers";

test.describe("Auth flow", () => {
  test("register a new account via the UI", async ({ page }) => {
    const id = uniqueId();
    await page.goto("/");

    // Click sign in button in navbar
    await page.locator(".btn-primary.btn-sm").filter({ hasText: "Sign In" }).click();

    // Switch to register mode
    await page.getByRole("button", { name: "Create one" }).click();

    // Fill form using placeholders/input order
    const inputs = page.locator(".modal input");
    await inputs.nth(0).fill(`testuser_${id}`);  // username
    await inputs.nth(1).fill(`test_${id}@example.com`);  // email
    await inputs.nth(2).fill("password123");  // password

    // Submit
    await page.locator(".modal .btn-primary").click();

    // Should see the username in nav after auth
    await expect(page.getByText(`testuser_${id}`)).toBeVisible();
  });

  test("login with existing seed account", async ({ page }) => {
    await page.goto("/");

    await page.locator(".btn-primary.btn-sm").filter({ hasText: "Sign In" }).click();

    const inputs = page.locator(".modal input");
    await inputs.nth(0).fill("admin@chronolore.dev");  // email
    await inputs.nth(1).fill("chronolore");  // password
    await page.locator(".modal .btn-primary").click();

    await expect(page.getByText("testadmin")).toBeVisible();
  });

  test("login persists across page reload", async ({ page }) => {
    await page.goto("/");
    await page.locator(".btn-primary.btn-sm").filter({ hasText: "Sign In" }).click();

    const inputs = page.locator(".modal input");
    await inputs.nth(0).fill("admin@chronolore.dev");
    await inputs.nth(1).fill("chronolore");
    await page.locator(".modal .btn-primary").click();
    await expect(page.getByText("testadmin")).toBeVisible();

    await page.reload();
    await expect(page.getByText("testadmin")).toBeVisible();
  });

  test("logout clears session", async ({ page }) => {
    await page.goto("/");
    await page.locator(".btn-primary.btn-sm").filter({ hasText: "Sign In" }).click();

    const inputs = page.locator(".modal input");
    await inputs.nth(0).fill("admin@chronolore.dev");
    await inputs.nth(1).fill("chronolore");
    await page.locator(".modal .btn-primary").click();
    await expect(page.getByText("testadmin")).toBeVisible();

    // Open user menu and click Sign Out
    await page.locator(".user-menu-trigger").click();
    await page.getByText("Sign Out").click();

    await expect(page.locator(".btn-primary.btn-sm").filter({ hasText: "Sign In" })).toBeVisible();
  });
});
