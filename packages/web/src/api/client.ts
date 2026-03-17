import type { EntryProgress, Section, Passage, Infobox, InfoboxField } from "@chronolore/shared";

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

/** Full article for editing — returns all statuses, no progress filtering */
export const getArticleForEdit = (universeSlug: string, articleSlug: string) =>
  fetchJson<any>(`/universes/${universeSlug}/contribute/${articleSlug}`, {
    auth: true,
  });

/** Fetch article-relevant reveal points for preview progress picker */
export const getArticleRevealPoints = (universeSlug: string, articleSlug: string) =>
  fetchJson<Array<{
    revealPointId: string;
    seriesName?: string;
    entryName: string;
    segmentName?: string;
    sortKey: string;
  }>>(`/universes/${universeSlug}/articles/${articleSlug}/reveal-points`, {
    auth: true,
  });

/** Fetch article with preview progress override */
export const getArticleWithPreviewProgress = async (
  universeSlug: string,
  articleSlug: string,
  previewProgressIds: string[],
) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    "X-Preview-Progress": previewProgressIds.join(","),
  };
  const res = await fetch(`${BASE}/universes/${universeSlug}/articles/${articleSlug}`, {
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
};

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

export const createSection = (
  universeSlug: string,
  articleSlug: string,
  data: { heading: string; sortOrder?: number; parentId?: string | null },
) =>
  fetchJson<Section>(
    `/universes/${universeSlug}/contribute/${articleSlug}/sections`,
    { method: "POST", body: data, auth: true },
  );

export const createPassage = (
  universeSlug: string,
  articleSlug: string,
  sectionId: string,
  data: {
    body: string;
    passageType?: string;
    sortOrder?: number;
    revealAtEntry?: string;
    revealAtSegment?: string;
  },
) =>
  fetchJson<Passage>(
    `/universes/${universeSlug}/contribute/${articleSlug}/sections/${sectionId}/passages`,
    { method: "POST", body: data, auth: true },
  );

export const updatePassage = (
  universeSlug: string,
  articleSlug: string,
  passageId: string,
  data: {
    body?: string;
    sortOrder?: number;
    revealAtEntry?: string;
    revealAtSegment?: string;
  },
) =>
  fetchJson<Passage>(
    `/universes/${universeSlug}/contribute/${articleSlug}/passages/${passageId}`,
    { method: "PUT", body: data, auth: true },
  );

export const submitPassageForReview = (
  universeSlug: string,
  articleSlug: string,
  passageId: string,
) =>
  fetchJson<Passage>(
    `/universes/${universeSlug}/contribute/${articleSlug}/passages/${passageId}/review`,
    { method: "POST", auth: true },
  );

// ── Moderation ──
export const getReviewQueue = (universeSlug: string) =>
  fetchJson<any>(`/universes/${universeSlug}/moderate/queue`, { auth: true });

export const getArticleForReview = (universeSlug: string, articleSlug: string) =>
  fetchJson<any>(`/universes/${universeSlug}/moderate/articles/${articleSlug}`, { auth: true });

export const publishArticle = (universeSlug: string, articleId: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/articles/${articleId}/publish`,
    { method: "POST", auth: true },
  );

export const rejectArticle = (universeSlug: string, articleId: string, reason?: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/articles/${articleId}/reject`,
    { method: "POST", body: { reason }, auth: true },
  );

export const publishPassage = (universeSlug: string, passageId: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/passages/${passageId}/publish`,
    { method: "POST", auth: true },
  );

export const rejectPassage = (universeSlug: string, passageId: string, reason?: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/passages/${passageId}/reject`,
    { method: "POST", body: { reason }, auth: true },
  );

export const publishInfobox = (universeSlug: string, infoboxId: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/infoboxes/${infoboxId}/publish`,
    { method: "POST", auth: true },
  );

export const rejectInfobox = (universeSlug: string, infoboxId: string, reason?: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/infoboxes/${infoboxId}/reject`,
    { method: "POST", body: { reason }, auth: true },
  );

export const submitArticleForReview = (universeSlug: string, articleSlug: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}/review`,
    { method: "POST", auth: true },
  );

export const submitInfoboxFieldForReview = (
  universeSlug: string,
  articleSlug: string,
  fieldId: string,
) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}/infobox/fields/${fieldId}/review`,
    { method: "POST", auth: true },
  );

export const publishInfoboxField = (universeSlug: string, fieldId: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/infobox-fields/${fieldId}/publish`,
    { method: "POST", auth: true },
  );

export const rejectInfoboxField = (universeSlug: string, fieldId: string, reason?: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/moderate/infobox-fields/${fieldId}/reject`,
    { method: "POST", body: { reason }, auth: true },
  );

export const bulkModerate = (
  universeSlug: string,
  action: "publish" | "reject",
  articleIds?: string[],
  passageIds?: string[],
  reason?: string,
) =>
  fetchJson<any>(`/universes/${universeSlug}/moderate/bulk`, {
    method: "POST",
    body: { action, articleIds, passageIds, reason },
    auth: true,
  });

// ── User Drafts ──
export const getUserDrafts = (universeSlug: string) =>
  fetchJson<any>(`/universes/${universeSlug}/contribute/drafts`, { auth: true });

export const renameArticle = (universeSlug: string, articleSlug: string, title: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}`,
    { method: "PUT", body: { title }, auth: true },
  );

export const deleteArticle = (universeSlug: string, articleSlug: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}`,
    { method: "DELETE", auth: true },
  );

export const updateSection = (
  universeSlug: string,
  articleSlug: string,
  sectionId: string,
  data: { heading?: string; sortOrder?: number; parentId?: string | null },
) =>
  fetchJson<Section>(
    `/universes/${universeSlug}/contribute/${articleSlug}/sections/${sectionId}`,
    { method: "PUT", body: data, auth: true },
  );

export const deleteSection = (
  universeSlug: string,
  articleSlug: string,
  sectionId: string,
) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}/sections/${sectionId}`,
    { method: "DELETE", auth: true },
  );

export const deletePassage = (
  universeSlug: string,
  articleSlug: string,
  passageId: string,
) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}/passages/${passageId}`,
    { method: "DELETE", auth: true },
  );

// ── Infobox ──
export const createInfobox = (
  universeSlug: string,
  articleSlug: string,
  data: { imageUrl?: string },
) =>
  fetchJson<Infobox>(
    `/universes/${universeSlug}/contribute/${articleSlug}/infobox`,
    { method: "POST", body: data, auth: true },
  );

export const updateInfobox = (
  universeSlug: string,
  articleSlug: string,
  data: { imageUrl?: string },
) =>
  fetchJson<Infobox>(
    `/universes/${universeSlug}/contribute/${articleSlug}/infobox`,
    { method: "PUT", body: data, auth: true },
  );

export const deleteInfobox = (universeSlug: string, articleSlug: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}/infobox`,
    { method: "DELETE", auth: true },
  );

export const createInfoboxField = (
  universeSlug: string,
  articleSlug: string,
  data: {
    fieldKey: string;
    fieldLabel: string;
    fieldValue: string;
    mode?: "replace" | "append";
    revealAtEntry?: string;
    revealAtSegment?: string;
    sortOrder?: number;
  },
) =>
  fetchJson<InfoboxField>(
    `/universes/${universeSlug}/contribute/${articleSlug}/infobox/fields`,
    { method: "POST", body: data, auth: true },
  );

export const updateInfoboxField = (
  universeSlug: string,
  articleSlug: string,
  fieldId: string,
  data: {
    fieldKey?: string;
    fieldLabel?: string;
    fieldValue?: string;
    mode?: "replace" | "append";
    sortOrder?: number;
    revealAtEntry?: string;
    revealAtSegment?: string;
  },
) =>
  fetchJson<InfoboxField>(
    `/universes/${universeSlug}/contribute/${articleSlug}/infobox/fields/${fieldId}`,
    { method: "PUT", body: data, auth: true },
  );

export const batchReorder = (
  universeSlug: string,
  articleSlug: string,
  data: {
    sectionOrder?: { id: string; sortOrder: number }[];
    passageOrder?: { id: string; sortOrder: number; sectionId?: string }[];
  },
) =>
  fetchJson<{ ok: boolean }>(
    `/universes/${universeSlug}/contribute/${articleSlug}/reorder`,
    { method: "PUT", body: data, auth: true },
  );

export const deleteInfoboxField = (
  universeSlug: string,
  articleSlug: string,
  fieldId: string,
) =>
  fetchJson<any>(
    `/universes/${universeSlug}/contribute/${articleSlug}/infobox/fields/${fieldId}`,
    { method: "DELETE", auth: true },
  );
