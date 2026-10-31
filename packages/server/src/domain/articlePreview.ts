export interface RevealPointReference {
  revealPointId: string | null;
}

export interface ArticleRevealPoint {
  revealPointId: string;
  seriesId: string | null;
  seriesName: string | null;
  seriesSortOrder: number | null;
  entryId: string;
  entryName: string;
  entrySortOrder: number;
  segmentId: string | null;
  segmentName: string | null;
  segmentSortOrder: number | null;
}

export function collectArticleRevealPointIds(
  passages: RevealPointReference[],
  infoboxFields: RevealPointReference[],
): string[] {
  const ids = new Set<string>();
  for (const item of [...passages, ...infoboxFields]) {
    if (item.revealPointId) ids.add(item.revealPointId);
  }
  return [...ids];
}

export function orderArticleRevealPoints<T extends ArticleRevealPoint>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const seriesComparison = compareSeries(a, b);
    if (seriesComparison !== 0) return seriesComparison;

    if (a.entrySortOrder !== b.entrySortOrder) {
      return a.entrySortOrder - b.entrySortOrder;
    }
    const entryComparison = compareText(a.entryName, b.entryName);
    if (entryComparison !== 0) return entryComparison;
    if (a.entryId !== b.entryId) return compareText(a.entryId, b.entryId);

    const aSegmentPosition = a.segmentSortOrder ?? -1;
    const bSegmentPosition = b.segmentSortOrder ?? -1;
    if (aSegmentPosition !== bSegmentPosition) {
      return aSegmentPosition - bSegmentPosition;
    }
    return compareText(a.segmentId ?? "", b.segmentId ?? "");
  });
}

export function resolvePreviewProgress(
  previewProgressHeader: string | undefined,
  isAuthenticated: boolean,
  readerProgressIds: string[],
): { isPreview: boolean; revealPointIds: string[] } {
  const isPreview = previewProgressHeader !== undefined && isAuthenticated;
  if (!isPreview) {
    return { isPreview: false, revealPointIds: readerProgressIds };
  }

  const revealPointIds = new Set(
    previewProgressHeader
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return { isPreview: true, revealPointIds: [...revealPointIds] };
}

function compareSeries(a: ArticleRevealPoint, b: ArticleRevealPoint): number {
  if (a.seriesId === null && b.seriesId !== null) return 1;
  if (a.seriesId !== null && b.seriesId === null) return -1;

  const aPosition = a.seriesSortOrder ?? 0;
  const bPosition = b.seriesSortOrder ?? 0;
  if (aPosition !== bPosition) return aPosition - bPosition;

  const nameComparison = compareText(a.seriesName ?? "", b.seriesName ?? "");
  if (nameComparison !== 0) return nameComparison;
  return compareText(a.seriesId ?? "", b.seriesId ?? "");
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b);
}
