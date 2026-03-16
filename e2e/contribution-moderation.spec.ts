import { test, expect } from "@playwright/test";
import {
  registerUser,
  setAuthInBrowser,
  setProgressInBrowser,
  loginUser,
  uniqueId,
} from "./helpers";

test.describe("Contribution and moderation flow", () => {
  test("create article draft, submit passage for review, approve as moderator", async ({
    page,
  }) => {
    const id = uniqueId();
    const API = "http://localhost:4001/api";

    // ── Step 1: Register a contributor ──
    const contributor = await registerUser(
      page,
      `contrib_${id}`,
      `contrib_${id}@test.com`,
      "password123",
    );

    // ── Step 2: Create an article via API ──
    const articleRes = await page.request.post(
      `${API}/universes/cosmere/contribute`,
      {
        data: {
          title: `Test Article ${id}`,
          slug: `test-article-${id}`,
          articleTypeSlug: "character",
          introducedAtEntry: "the-final-empire",
          introducedAtSegment: "chapter-1",
        },
        headers: { Authorization: `Bearer ${contributor.token}` },
      },
    );
    expect(articleRes.ok()).toBe(true);
    const article = await articleRes.json();

    // ── Step 3: Add a section ──
    const sectionRes = await page.request.post(
      `${API}/universes/cosmere/contribute/test-article-${id}/sections`,
      {
        data: { heading: "Background", sortOrder: 0 },
        headers: { Authorization: `Bearer ${contributor.token}` },
      },
    );
    expect(sectionRes.ok()).toBe(true);
    const section = await sectionRes.json();

    // ── Step 4: Add a passage ──
    const passageRes = await page.request.post(
      `${API}/universes/cosmere/contribute/test-article-${id}/sections/${section.id}/passages`,
      {
        data: {
          body: `This is test passage content ${id}`,
          revealAtEntry: "the-final-empire",
          revealAtSegment: "chapter-1",
        },
        headers: { Authorization: `Bearer ${contributor.token}` },
      },
    );
    expect(passageRes.ok()).toBe(true);
    const passage = await passageRes.json();

    // ── Step 5: Submit passage for review ──
    const reviewRes = await page.request.post(
      `${API}/universes/cosmere/contribute/test-article-${id}/passages/${passage.id}/review`,
      {
        headers: { Authorization: `Bearer ${contributor.token}` },
      },
    );
    expect(reviewRes.ok()).toBe(true);

    // ── Step 6: Submit article for review (set status to review) ──
    // The contribute routes don't have a direct "submit article for review"
    // so we use the moderate endpoint to publish directly with admin

    // ── Step 7: Login as admin (seed user) and approve ──
    const admin = await loginUser(
      page,
      "admin@chronolore.dev",
      "chronolore",
    );

    // Publish the article
    const pubArticleRes = await page.request.post(
      `${API}/universes/cosmere/moderate/articles/${article.id}/publish`,
      {
        headers: { Authorization: `Bearer ${admin.token}` },
      },
    );
    expect(pubArticleRes.ok()).toBe(true);

    // Publish the passage
    const pubPassageRes = await page.request.post(
      `${API}/universes/cosmere/moderate/passages/${passage.id}/publish`,
      {
        headers: { Authorization: `Bearer ${admin.token}` },
      },
    );
    expect(pubPassageRes.ok()).toBe(true);

    // ── Step 8: Verify the article is now visible in the UI ──
    await page.goto("/cosmere");
    await setProgressInBrowser(page, "cosmere", {
      "the-final-empire": "chapter-1",
    });
    await page.goto(`/cosmere/articles/test-article-${id}`);

    await expect(page.getByText(`Test Article ${id}`)).toBeVisible();
    await expect(
      page.getByText(`This is test passage content ${id}`),
    ).toBeVisible();
  });

  test("moderator can view review queue in UI", async ({ page }) => {
    // Login as admin
    await page.goto("/");
    await setAuthInBrowser(
      page,
      (await loginUser(page, "admin@chronolore.dev", "chronolore")).token,
      {
        id: "",
        username: "testadmin",
        email: "admin@chronolore.dev",
        role: "admin",
      },
    );

    await setProgressInBrowser(page, "cosmere", {
      "the-final-empire": "complete",
    });

    await page.goto("/cosmere/moderate");

    // The review queue page should load
    await expect(page.getByText(/review queue/i)).toBeVisible();
  });

  test("rejected article does not appear in public view", async ({ page }) => {
    const id = uniqueId();
    const API = "http://localhost:4001/api";

    // Create and reject an article
    const contributor = await registerUser(
      page,
      `rej_${id}`,
      `rej_${id}@test.com`,
      "password123",
    );

    const articleRes = await page.request.post(
      `${API}/universes/cosmere/contribute`,
      {
        data: {
          title: `Rejected Article ${id}`,
          slug: `rejected-${id}`,
          articleTypeSlug: "character",
          introducedAtEntry: "the-final-empire",
          introducedAtSegment: "chapter-1",
        },
        headers: { Authorization: `Bearer ${contributor.token}` },
      },
    );
    const article = await articleRes.json();

    // Admin rejects it
    const admin = await loginUser(page, "admin@chronolore.dev", "chronolore");
    await page.request.post(
      `${API}/universes/cosmere/moderate/articles/${article.id}/reject`,
      {
        data: { reason: "Not appropriate" },
        headers: { Authorization: `Bearer ${admin.token}` },
      },
    );

    // Verify it doesn't appear in the public article list
    await page.goto("/cosmere");
    await setProgressInBrowser(page, "cosmere", {
      "the-final-empire": "complete",
    });
    await page.reload();

    await expect(page.getByText(`Rejected Article ${id}`)).not.toBeVisible();
  });
});
