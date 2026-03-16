import { useState, useEffect, useMemo } from "react";
import { getMediaTree } from "../../api/client";
import { BOOK_COLORS, BOOK_BG_COLORS, type BookColor } from "./types";

interface EntryNode {
  slug: string;
  name: string;
  id?: string;
}

interface SeriesNode {
  name: string;
  entries: EntryNode[];
}

/**
 * Fetches the media tree for a universe and assigns consistent colors
 * to each entry (book). Returns a lookup by entry slug.
 */
export function useBookColors(universeSlug: string) {
  const [tree, setTree] = useState<{
    series: SeriesNode[];
    ungrouped: EntryNode[];
  } | null>(null);

  useEffect(() => {
    getMediaTree(universeSlug).then(setTree);
  }, [universeSlug]);

  const colorMap = useMemo(() => {
    if (!tree) return new Map<string, BookColor>();

    const allEntries = [
      ...tree.series.flatMap((s) => s.entries),
      ...tree.ungrouped,
    ];

    const map = new Map<string, BookColor>();
    allEntries.forEach((entry, i) => {
      const idx = i % BOOK_COLORS.length;
      map.set(entry.slug, {
        name: entry.name,
        color: BOOK_COLORS[idx],
        bg: BOOK_BG_COLORS[idx],
      });
    });
    return map;
  }, [tree]);

  return { colorMap, tree };
}
