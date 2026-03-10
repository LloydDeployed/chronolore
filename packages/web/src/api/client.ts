import type { EntryProgress } from "@chronolore/shared";

const BASE = "/api";

function getProgressHeader(universeSlug: string): Record<string, string> {
  try {
    const raw = localStorage.getItem("chronolore-progress");
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, EntryProgress>;
    const universeProgress = all[universeSlug];
    if (!universeProgress || Object.keys(universeProgress).length === 0)
      return {};
    return { "X-Chronolore-Progress": JSON.stringify(universeProgress) };
  } catch {
    return {};
  }
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("chronolore-token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function fetchJson<T>(
  path: string,
  options?: {
    universeSlug?: string;
    method?: string;
    body?: unknown;
    auth?: boolean;
  },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.universeSlug
      ? getProgressHeader(options.universeSlug)
      : {}),
    ...(options?.auth ? getAuthHeader() : {}),
  };
  const res = await fetch(`${BASE}${path}`, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Universes ──
export const getUniverses = () => fetchJson<any[]>("/universes");
export const getUniverse = (slug: string) =>
  fetchJson<any>(`/universes/${slug}`);
export const getMediaTree = (slug: string) =>
  fetchJson<any>(`/universes/${slug}/media`);

// ── Articles (progress-scoped) ──
export const getArticles = (universeSlug: string) =>
  fetchJson<any[]>(`/universes/${universeSlug}/articles`, {
    universeSlug,
  });
export const getArticle = (universeSlug: string, articleSlug: string) =>
  fetchJson<any>(`/universes/${universeSlug}/articles/${articleSlug}`, {
    universeSlug,
  });

// ── Search (progress-scoped) ──
export const searchArticles = (universeSlug: string, query: string) =>
  fetchJson<any[]>(
    `/universes/${universeSlug}/search?q=${encodeURIComponent(query)}`,
    { universeSlug },
  );

// ── Auth ──
export const register = (username: string, email: string, password: string) =>
  fetchJson<any>("/auth/register", {
    method: "POST",
    body: { username, email, password },
  });
export const login = (email: string, password: string) =>
  fetchJson<any>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
export const getMe = () =>
  fetchJson<any>("/auth/me", { auth: true });

// ── Contributing ──
export const createArticle = (
  universeSlug: string,
  data: {
    title: string;
    slug: string;
    articleTypeSlug: string;
    introducedAtEntry: string;
    introducedAtSegment?: string;
  },
) =>
  fetchJson<any>(`/universes/${universeSlug}/contribute`, {
    method: "POST",
    body: data,
    auth: true,
  });

export const createBlock = (
  universeSlug: string,
  articleSlug: string,
  data: {
    blockType: string;
    heading?: string;
    body?: string;
    metadata?: Record<string, unknown>;
    parentId?: string;
    sortOrder?: number;
    revealAtEntry: string;
    revealAtSegment?: string;
  },
) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}/blocks`,
    { method: "POST", body: data, auth: true },
  );

export const updateBlock = (
  universeSlug: string,
  articleSlug: string,
  blockId: string,
  data: {
    heading?: string;
    body?: string;
    metadata?: Record<string, unknown>;
    sortOrder?: number;
    revealAtEntry?: string;
    revealAtSegment?: string;
  },
) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}/blocks/${blockId}`,
    { method: "PUT", body: data, auth: true },
  );

// ── Moderation ──
export const getReviewQueue = (universeSlug: string) =>
  fetchJson<any>(`/universes/${universeSlug}/moderate/queue`, { auth: true });

export const publishArticle = (universeSlug: string, articleId: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/articles/${articleId}/publish`,
    { method: "POST", auth: true },
  );

export const rejectArticle = (universeSlug: string, articleId: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/articles/${articleId}/reject`,
    { method: "POST", auth: true },
  );

export const publishBlock = (universeSlug: string, blockId: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/blocks/${blockId}/publish`,
    { method: "POST", auth: true },
  );

export const rejectBlock = (universeSlug: string, blockId: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/blocks/${blockId}/reject`,
    { method: "POST", auth: true },
  );

export const bulkModerate = (
  universeSlug: string,
  action: "publish" | "reject",
  articleIds?: string[],
  blockIds?: string[],
) =>
  fetchJson<any>(`/universes/${universeSlug}/moderate/bulk`, {
    method: "POST",
    body: { action, articleIds, blockIds },
    auth: true,
  });

export const submitBlockForReview = (
  universeSlug: string,
  articleSlug: string,
  blockId: string,
) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}/blocks/${blockId}/review`,
    { method: "POST", auth: true },
  );
