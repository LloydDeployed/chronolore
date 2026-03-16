import { test, expect } from "@playwright/test";
import { setProgressInBrowser } from "./helpers";

test.describe("Reading progress", () => {
  test("progress set via sidebar persists across page loads", async ({
    page,
  }) => {
    await page.goto("/cosmere");

    // Expand the series in the sidebar
    await page.getByText("Mistborn Era 1").click();

    // Check "The Final Empire" — marks it complete
    const tfeCheckbox = page
      .locator(".entry")
      .filter({ hasText: "The Final Empire" })
      .getByRole("checkbox")
      .first();
    await tfeCheckbox.check();

    // Articles should now appear (welcome message should be gone)
    await expect(page.getByText("Set your reading progress")).not.toBeVisible();

    // Reload and verify progress persisted
    await page.reload();
    await expect(page.getByText("Set your reading progress")).not.toBeVisible();

    // Articles should still be visible
    await expect(page.getByText("Kelsier")).toBeVisible();
  });

  test("setting chapter-level progress via sidebar", async ({ page }) => {
    await page.goto("/cosmere");

    // Expand series, then entry
    await page.getByText("Mistborn Era 1").click();

    // Expand The Final Empire to see chapters
    const tfeEntry = page
      .locator(".entry")
      .filter({ hasText: "The Final Empire" });
    await tfeEntry.getByRole("button", { name: /▶/ }).click();

    // Check exactly "Chapter 3" (use exact label match)
    const ch3 = tfeEntry
      .locator("label.chapter")
      .filter({ hasText: /^Chapter 3$/ })
      .getByRole("checkbox");
    await ch3.check();

    // Kelsier (introduced ch1) should appear in article list
    await expect(page.getByText("Kelsier")).toBeVisible();

    // Navigate to Kelsier and verify ch3 content is visible
    await page.getByText("Kelsier").click();
    await expect(page.getByText("Survivor of Hathsin")).toBeVisible();
  });

  test("progress is stored per-universe in localStorage", async ({ page }) => {
    await page.goto("/cosmere");
    await setProgressInBrowser(page, "cosmere", {
      "the-final-empire": "chapter-5",
    });

    // Check localStorage directly
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("chronolore-progress") || "{}"),
    );

    expect(stored.cosmere).toEqual({ "the-final-empire": "chapter-5" });
  });
});
