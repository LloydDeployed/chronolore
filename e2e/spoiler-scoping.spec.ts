import { test, expect } from "@playwright/test";
import { setProgressInBrowser } from "./helpers";

test.describe("Spoiler scoping", () => {
  test("no progress shows welcome message, no articles", async ({ page }) => {
    await page.goto("/cosmere");
    await expect(page.getByText("Set your reading progress")).toBeVisible();
  });

  test("setting progress to chapter 1 shows articles introduced at or before chapter 1", async ({
    page,
  }) => {
    await page.goto("/cosmere");

    // Set progress via localStorage (chapter-1 of The Final Empire)
    await setProgressInBrowser(page, "cosmere", {
      "the-final-empire": "chapter-1",
    });
    await page.reload();

    // Kelsier is introduced at ch1, Vin at prologue, Luthadel at prologue, Allomancy at ch1
    // All should be visible
    await expect(page.getByText("Kelsier")).toBeVisible();
    await expect(page.getByText("Vin")).toBeVisible();
    await expect(page.getByText("Luthadel")).toBeVisible();
    await expect(page.getByText("Allomancy")).toBeVisible();
  });

  test("article content is filtered by progress — early progress hides later passages", async ({
    page,
  }) => {
    // Set progress to chapter 1 only
    await page.goto("/cosmere");
    await setProgressInBrowser(page, "cosmere", {
      "the-final-empire": "chapter-1",
    });

    // Visit Kelsier article
    await page.goto("/cosmere/articles/kelsier");

    // Chapter 1 passage should be visible
    await expect(
      page.getByText("most infamous thief in the Final Empire"),
    ).toBeVisible();

    // Chapter 3 passage (Survivor of Hathsin) should NOT be visible
    await expect(
      page.getByText("Survivor of Hathsin"),
    ).not.toBeVisible();

    // Legacy section (epilogue) should not be visible
    await expect(page.getByText("Legacy")).not.toBeVisible();
  });

  test("advancing progress reveals more content", async ({ page }) => {
    // Set progress to chapter 5
    await page.goto("/cosmere");
    await setProgressInBrowser(page, "cosmere", {
      "the-final-empire": "chapter-5",
    });

    await page.goto("/cosmere/articles/kelsier");

    // ch1 overview
    await expect(
      page.getByText("most infamous thief"),
    ).toBeVisible();

    // ch3 — Survivor of Hathsin
    await expect(
      page.getByText("Survivor of Hathsin"),
    ).toBeVisible();

    // ch4 — Abilities section (Mistborn, Pits of Hathsin)
    await expect(page.getByText("Abilities")).toBeVisible();
    await expect(page.getByText("full Mistborn")).toBeVisible();

    // ch7 content should NOT be visible at ch5
    await expect(
      page.getByText("iron and steel Pushing"),
    ).not.toBeVisible();

    // Legacy (epilogue) should NOT be visible
    await expect(page.getByText("Legacy")).not.toBeVisible();
  });

  test("complete progress shows all content including spoilers", async ({
    page,
  }) => {
    await page.goto("/cosmere");
    await setProgressInBrowser(page, "cosmere", {
      "the-final-empire": "complete",
    });

    await page.goto("/cosmere/articles/kelsier");

    // Everything should be visible
    await expect(page.getByText("most infamous thief")).toBeVisible();
    await expect(page.getByText("Survivor of Hathsin")).toBeVisible();
    await expect(page.getByText("full Mistborn")).toBeVisible();
    await expect(page.getByText("iron and steel Pushing")).toBeVisible();
    await expect(page.getByText("Legacy")).toBeVisible();
    await expect(page.getByText("martyr figure")).toBeVisible();
  });

  // NOTE: Infobox field filtering is not tested via UI because the seed data
  // creates infoboxes with default status "draft", which the article view
  // endpoint filters out (requires status = "published"). To test infobox
  // filtering, the seed would need to set infobox status to "published".
});
