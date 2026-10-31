import { test, expect } from "@playwright/test";
import {
  loginUser,
  setAuthInBrowser,
  setProgressInBrowser,
} from "./helpers";

test.describe("article preview progress", () => {
  test("offers only article checkpoints and simulates progress without persisting it", async ({
    page,
  }) => {
    const admin = await loginUser(page, "admin@chronolore.dev", "chronolore");
    await page.goto("/");
    await setAuthInBrowser(page, admin.token, admin.user);
    await setProgressInBrowser(page, "cosmere", {
      "the-final-empire": "complete",
    });

    await page.goto("/cosmere/articles/kelsier/edit");
    await page.getByRole("button", { name: "Preview" }).click();

    const picker = page.locator(".preview-progress-picker");
    await expect(picker).toBeVisible();
    await expect(picker.locator(".picker-segment")).toHaveCount(6);
    await expect(picker.locator(".segment-label")).toHaveText([
      "Chapter 1",
      "Chapter 3",
      "Chapter 4",
      "Chapter 7",
      "Chapter 38",
      "Epilogue",
    ]);
    await expect(picker.getByText("Chapter 2", { exact: true })).toHaveCount(0);

    await expect(page.getByText("most infamous thief in the Final Empire")).not.toBeVisible();
    await picker.getByLabel("Chapter 1").check();
    await expect(page.getByText("most infamous thief in the Final Empire")).toBeVisible();
    await expect(page.getByText("Survivor of Hathsin", { exact: true })).not.toBeVisible();

    await picker.getByRole("button", { name: "All" }).click();
    await expect(page.getByText("Survivor of Hathsin", { exact: true })).toBeVisible();
    await picker.getByRole("button", { name: "None" }).click();
    await expect(page.getByText("most infamous thief in the Final Empire")).not.toBeVisible();
    await expect(page.locator(".infobox")).not.toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("chronolore-progress")),
      )
      .toBe(JSON.stringify({ cosmere: { "the-final-empire": "complete" } }));
  });
});
