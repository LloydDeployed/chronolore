import { type Page } from "@playwright/test";

const API = "http://localhost:4001/api";

/** Register a user via the API and return { token, user } */
export async function registerUser(
  page: Page,
  username: string,
  email: string,
  password: string,
) {
  const res = await page.request.post(`${API}/auth/register`, {
    data: { username, email, password },
  });
  if (!res.ok()) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Register failed: ${res.status()} ${body.error ?? ""}`);
  }
  return res.json() as Promise<{
    token: string;
    user: { id: string; username: string; email: string; role: string };
  }>;
}

/** Login via API */
export async function loginUser(page: Page, email: string, password: string) {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
  return res.json() as Promise<{
    token: string;
    user: { id: string; username: string; email: string; role: string };
  }>;
}

/** Set auth in localStorage so the app picks it up */
export async function setAuthInBrowser(
  page: Page,
  token: string,
  user: { id: string; username: string; email: string; role: string },
) {
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem("chronolore-token", token);
      localStorage.setItem("chronolore-user", JSON.stringify(user));
    },
    { token, user },
  );
}

/** Set reading progress in localStorage */
export async function setProgressInBrowser(
  page: Page,
  universeSlug: string,
  progress: Record<string, string>,
) {
  await page.evaluate(
    ({ universeSlug, progress }) => {
      const all = JSON.parse(
        localStorage.getItem("chronolore-progress") || "{}",
      );
      all[universeSlug] = progress;
      localStorage.setItem("chronolore-progress", JSON.stringify(all));
    },
    { universeSlug, progress },
  );
}

/** Generate a unique suffix for test isolation */
export function uniqueId() {
  return Math.random().toString(36).slice(2, 8);
}
