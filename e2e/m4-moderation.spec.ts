import { expect, test, type Page } from "@playwright/test";
import {
  loginUser,
  registerUser,
  setAuthInBrowser,
  setProgressInBrowser,
  uniqueId,
} from "./helpers";

const API = "http://localhost:4001/api";

async function apiPost<T>(
  page: Page,
  path: string,
  token: string,
  data?: unknown,
) {
  const response = await page.request.post(`${API}${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as T;
}

async function apiPut<T>(
  page: Page,
  path: string,
  token: string,
  data?: unknown,
) {
  const response = await page.request.put(`${API}${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as T;
}

async function createDraftArticle(page: Page, token: string, id: string) {
  const title = `M4 Review Article ${id}`;
  const slug = `m4-review-${id}`;

  const article = await apiPost<any>(page, "/universes/cosmere/contribute", token, {
    title,
    slug,
    articleTypeSlug: "character",
    introducedAtEntry: "the-final-empire",
    introducedAtSegment: "chapter-1",
  });

  const section = await apiPost<any>(
    page,
    `/universes/cosmere/contribute/${slug}/sections`,
    token,
    { heading: "Overview", sortOrder: 0 },
  );

  const passage = await apiPost<any>(
    page,
    `/universes/cosmere/contribute/${slug}/sections/${section.id}/passages`,
    token,
    {
      body: `Published body ${id}`,
      revealAtEntry: "the-final-empire",
      revealAtSegment: "chapter-1",
    },
  );

  return { article, section, passage, slug, title };
}

async function signInAsAdmin(page: Page) {
  const admin = await loginUser(page, "admin@chronolore.dev", "chronolore");
  await page.goto("/");
  await setAuthInBrowser(page, admin.token, admin.user);
  return admin;
}

test.describe("M4 moderation flows", () => {
  test("moderation detail shows pending published revisions and infobox review items", async ({
    page,
  }) => {
    const id = uniqueId();
    const contributor = await registerUser(
      page,
      `m4_${id}`,
      `m4_${id}@test.com`,
      "password123",
    );
    const { article, passage, slug, title } = await createDraftArticle(
      page,
      contributor.token,
      id,
    );

    await apiPost(
      page,
      `/universes/cosmere/contribute/${slug}/review`,
      contributor.token,
    );
    await apiPost(
      page,
      `/universes/cosmere/contribute/${slug}/passages/${passage.id}/review`,
      contributor.token,
    );

    const admin = await loginUser(page, "admin@chronolore.dev", "chronolore");
    await apiPost(
      page,
      `/universes/cosmere/moderate/articles/${article.id}/publish`,
      admin.token,
    );
    await apiPost(
      page,
      `/universes/cosmere/moderate/passages/${passage.id}/publish`,
      admin.token,
    );

    await apiPost(
      page,
      `/universes/cosmere/contribute/${slug}/infobox`,
      contributor.token,
      {},
    );
    const field = await apiPost<any>(
      page,
      `/universes/cosmere/contribute/${slug}/infobox/fields`,
      contributor.token,
      {
        fieldKey: "gear",
        fieldLabel: "Gear",
        fieldValue: `Mist-cloak ${id}`,
        revealAtEntry: "the-final-empire",
        revealAtSegment: "chapter-1",
        sortOrder: 0,
      },
    );
    await apiPost(
      page,
      `/universes/cosmere/contribute/${slug}/infobox/fields/${field.id}/review`,
      contributor.token,
    );

    const revisedBody = `Revised body ${id}`;
    await apiPut(
      page,
      `/universes/cosmere/contribute/${slug}/passages/${passage.id}`,
      contributor.token,
      { body: revisedBody },
    );
    await apiPost(
      page,
      `/universes/cosmere/contribute/${slug}/passages/${passage.id}/review`,
      contributor.token,
    );

    await signInAsAdmin(page);
    await page.goto("/cosmere/moderate");

    const queueCard = page.locator(".queue-card").filter({ hasText: title });
    await expect(queueCard).toBeVisible();
    await queueCard.getByRole("button", { name: /review/i }).click();

    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    let passageRow = page.locator(".review-passage").filter({ hasText: revisedBody });
    await expect(passageRow).toBeVisible();
    await expect(passageRow.getByText("Currently live:")).toBeVisible();
    await expect(passageRow.getByText(`Published body ${id}`)).toBeVisible();

    let fieldRow = page.locator(".review-field").filter({
      hasText: `Mist-cloak ${id}`,
    });
    await expect(fieldRow).toBeVisible();

    await passageRow.getByRole("button", { name: /publish/i }).click();
    passageRow = page.locator(".review-passage").filter({ hasText: revisedBody });
    await expect(passageRow.getByText("Currently live:")).toHaveCount(0);
    await expect(
      passageRow.getByRole("button", { name: /publish/i }),
    ).toHaveCount(0);

    await fieldRow.locator(".review-field-actions button").first().click();
    fieldRow = page.locator(".review-field").filter({
      hasText: `Mist-cloak ${id}`,
    });
    await expect(
      fieldRow.locator(".review-field-actions button"),
    ).toHaveCount(0);

    await page.goto("/cosmere");
    await setProgressInBrowser(page, "cosmere", {
      "the-final-empire": "complete",
    });
    await page.goto(`/cosmere/articles/${slug}`);

    const infobox = page.locator(".infobox");
    await expect(page.getByText(revisedBody)).toBeVisible();
    await expect(infobox.getByText(`Mist-cloak ${id}`)).toBeVisible();
  });

  test.describe("mobile smoke", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("review queue and detail remain usable on narrow screens", async ({
      page,
    }) => {
      const id = uniqueId();
      const contributor = await registerUser(
        page,
        `mobile_${id}`,
        `mobile_${id}@test.com`,
        "password123",
      );
      const { passage, slug, title } = await createDraftArticle(
        page,
        contributor.token,
        id,
      );

      await apiPost(
        page,
        `/universes/cosmere/contribute/${slug}/review`,
        contributor.token,
      );
      await apiPost(
        page,
        `/universes/cosmere/contribute/${slug}/passages/${passage.id}/review`,
        contributor.token,
      );

      await signInAsAdmin(page);
      await page.goto("/cosmere/moderate");

      const queueCard = page.locator(".queue-card").filter({ hasText: title });
      await expect(queueCard).toBeVisible();
      await queueCard.getByRole("button", { name: /review/i }).click();

      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await expect(page.locator(".review-action-bar")).toBeVisible();

      const articlePublishButton = page.getByRole("button", {
        name: /publish article/i,
      });
      await expect(articlePublishButton).toBeVisible();
      await articlePublishButton.click();

      const passageRow = page.locator(".review-passage").filter({
        hasText: `Published body ${id}`,
      });
      await expect(passageRow).toBeVisible();
      await expect(
        passageRow.getByRole("button", { name: /publish/i }),
      ).toBeVisible();
    });
  });
});
