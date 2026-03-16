import { useState, useEffect, useMemo } from "react";
import { getArticleRevealPoints } from "../api/client";

interface RevealPointInfo {
  revealPointId: string;
  seriesName?: string;
  entryName: string;
  segmentName?: string;
  sortKey: string;
}

interface Props {
  universeSlug: string;
  articleSlug: string;
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

interface GroupedEntry {
  entryName: string;
  seriesName?: string;
  points: RevealPointInfo[];
}

export function PreviewProgressPicker({ universeSlug, articleSlug, selectedIds, onChange }: Props) {
  const [revealPoints, setRevealPoints] = useState<RevealPointInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getArticleRevealPoints(universeSlug, articleSlug)
      .then((data) => {
        if (!cancelled) setRevealPoints(data);
      })
      .catch(() => {
        if (!cancelled) setRevealPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [universeSlug, articleSlug]);

  // Group by series → entry
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedEntry>();
    for (const rp of revealPoints) {
      const key = `${rp.seriesName ?? ""}::${rp.entryName}`;
      if (!map.has(key)) {
        map.set(key, { entryName: rp.entryName, seriesName: rp.seriesName, points: [] });
      }
      map.get(key)!.points.push(rp);
    }
    return [...map.values()];
  }, [revealPoints]);

  const allIds = useMemo(() => new Set(revealPoints.map((r) => r.revealPointId)), [revealPoints]);

  if (loading) return <div className="preview-progress-picker"><p className="loading-text">Loading reveal points…</p></div>;
  if (revealPoints.length === 0) return null; // No reveal-gated content

  const allSelected = allIds.size > 0 && [...allIds].every((id) => selectedIds.has(id));
  const noneSelected = ![...allIds].some((id) => selectedIds.has(id));

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  // "Select through here" — select this point and all before it (by sort order)
  const selectThrough = (targetIdx: number) => {
    const next = new Set(selectedIds);
    for (let i = 0; i <= targetIdx; i++) {
      next.add(revealPoints[i].revealPointId);
    }
    // Deselect anything after
    for (let i = targetIdx + 1; i < revealPoints.length; i++) {
      next.delete(revealPoints[i].revealPointId);
    }
    onChange(next);
  };

  return (
    <div className="preview-progress-picker">
      <div className="picker-header">
        <span className="picker-title">📖 Simulated Progress</span>
        <div className="picker-actions">
          <button
            className="btn-tiny"
            disabled={allSelected}
            onClick={() => onChange(new Set(allIds))}
          >
            All
          </button>
          <button
            className="btn-tiny"
            disabled={noneSelected}
            onClick={() => onChange(new Set())}
          >
            None
          </button>
        </div>
      </div>
      <div className="picker-body">
        {grouped.map((group) => (
          <div key={`${group.seriesName}::${group.entryName}`} className="picker-group">
            {group.seriesName && (
              <div className="picker-series">{group.seriesName}</div>
            )}
            <div className="picker-entry">{group.entryName}</div>
            <div className="picker-segments">
              {group.points.map((rp) => {
                const globalIdx = revealPoints.indexOf(rp);
                return (
                  <label key={rp.revealPointId} className="picker-segment">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(rp.revealPointId)}
                      onChange={() => toggle(rp.revealPointId)}
                    />
                    <span
                      className="segment-label"
                      onDoubleClick={() => selectThrough(globalIdx)}
                      title="Double-click to select through here"
                    >
                      {rp.segmentName ?? "(entry-level)"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
