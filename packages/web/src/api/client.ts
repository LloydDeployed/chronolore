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

async function fetchJson<T>(
  path: string,
  universeSlug?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(universeSlug ? getProgressHeader(universeSlug) : {}),
  };
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Universes
export const getUniverses = () => fetchJson<any[]>("/universes");
export const getUniverse = (slug: string) =>
  fetchJson<any>(`/universes/${slug}`);
export const getMediaTree = (slug: string) =>
  fetchJson<any>(`/universes/${slug}/media`);

// Articles (progress-scoped)
export const getArticles = (universeSlug: string) =>
  fetchJson<any[]>(`/universes/${universeSlug}/articles`, universeSlug);
export const getArticle = (universeSlug: string, articleSlug: string) =>
  fetchJson<any>(
    `/universes/${universeSlug}/articles/${articleSlug}`,
    universeSlug,
  );

// Search (progress-scoped)
export const searchArticles = (universeSlug: string, query: string) =>
  fetchJson<any[]>(
    `/universes/${universeSlug}/search?q=${encodeURIComponent(query)}`,
    universeSlug,
  );
