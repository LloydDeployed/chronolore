import { useState, useEffect, useRef, useCallback } from "react";
import { getMediaTree } from "../api/client";

interface Props {
  universeSlug: string;
  label: string;
  entryValue: string;
  segmentValue: string;
  onEntryChange: (val: string) => void;
  onSegmentChange: (val: string) => void;
}

interface SegmentNode {
  slug: string;
  name: string;
  segmentType: string;
}

interface EntryNode {
  slug: string;
  name: string;
  segments: SegmentNode[];
}

interface SeriesNode {
  name: string;
  entries: EntryNode[];
}

type TreeData = { series: SeriesNode[]; ungrouped: EntryNode[] };

function filterTree(tree: TreeData, query: string): TreeData {
  const q = query.toLowerCase().trim();
  if (!q) return tree;

  const words = q.split(/\s+/);
  const matches = (text: string) => {
    const lower = text.toLowerCase();
    return words.every((w) => lower.includes(w));
  };

  const filteredSeries = tree.series
    .map((s) => {
      // If series name matches, include all its entries
      if (matches(s.name)) return s;
      // Otherwise filter entries
      const matchedEntries = s.entries.filter((e) => matches(e.name));
      if (matchedEntries.length === 0) return null;
      return { ...s, entries: matchedEntries };
    })
    .filter(Boolean) as SeriesNode[];

  const filteredUngrouped = tree.ungrouped.filter((e) => matches(e.name));

  return { series: filteredSeries, ungrouped: filteredUngrouped };
}

export function RevealPointPicker({
  universeSlug,
  label,
  entryValue,
  segmentValue,
  onEntryChange,
  onSegmentChange,
}: Props) {
  const [tree, setTree] = useState<TreeData | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMediaTree(universeSlug).then(setTree);
  }, [universeSlug]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allEntries = tree
    ? [...tree.series.flatMap((s) => s.entries), ...tree.ungrouped]
    : [];

  const selectedEntry = allEntries.find((e) => e.slug === entryValue);
  const displayName = selectedEntry?.name ?? "";

  const filtered = tree ? filterTree(tree, query) : null;

  // Flat list of entry slugs in display order (for keyboard nav)
  const flatEntries: EntryNode[] = filtered
    ? [...filtered.series.flatMap((s) => s.entries), ...filtered.ungrouped]
    : [];

  const selectEntry = useCallback(
    (slug: string) => {
      onEntryChange(slug);
      onSegmentChange("");
      setOpen(false);
      setQuery("");
      setHighlightIdx(-1);
    },
    [onEntryChange, onSegmentChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, flatEntries.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < flatEntries.length) {
          selectEntry(flatEntries[highlightIdx].slug);
        }
        break;
      case "Escape":
        setOpen(false);
        setQuery("");
        setHighlightIdx(-1);
        break;
    }
  };

  const chapters =
    selectedEntry?.segments.filter((s) => s.segmentType === "chapter") ?? [];

  if (!tree) return <div>Loading...</div>;

  return (
    <div className="reveal-picker" ref={containerRef}>
      <label className="form-label">{label}</label>
      <div className="reveal-picker-selects">
        {/* Filterable entry picker */}
        <div className="reveal-picker__combo">
          <input
            ref={inputRef}
            type="text"
            className="reveal-picker__input"
            placeholder={entryValue ? displayName : "Search book/entry..."}
            value={open ? query : ""}
            onFocus={() => {
              setOpen(true);
              setQuery("");
              setHighlightIdx(-1);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightIdx(0);
            }}
            onKeyDown={handleKeyDown}
          />
          {entryValue && !open && (
            <button
              type="button"
              className="reveal-picker__clear"
              onClick={() => {
                onEntryChange("");
                onSegmentChange("");
                inputRef.current?.focus();
              }}
              title="Clear selection"
            >
              ×
            </button>
          )}

          {open && filtered && (
            <div className="reveal-picker__dropdown">
              {filtered.series.length === 0 && filtered.ungrouped.length === 0 && (
                <div className="reveal-picker__empty">No matches</div>
              )}
              {filtered.series.map((s) => (
                <div key={s.name} className="reveal-picker__group">
                  <div className="reveal-picker__group-label">{s.name}</div>
                  {s.entries.map((entry) => {
                    const idx = flatEntries.indexOf(entry);
                    return (
                      <div
                        key={entry.slug}
                        className={`reveal-picker__option ${entry.slug === entryValue ? "reveal-picker__option--selected" : ""} ${idx === highlightIdx ? "reveal-picker__option--highlighted" : ""}`}
                        onMouseEnter={() => setHighlightIdx(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault(); // prevent blur
                          selectEntry(entry.slug);
                        }}
                      >
                        {entry.name}
                      </div>
                    );
                  })}
                </div>
              ))}
              {filtered.ungrouped.map((entry) => {
                const idx = flatEntries.indexOf(entry);
                return (
                  <div
                    key={entry.slug}
                    className={`reveal-picker__option ${entry.slug === entryValue ? "reveal-picker__option--selected" : ""} ${idx === highlightIdx ? "reveal-picker__option--highlighted" : ""}`}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectEntry(entry.slug);
                    }}
                  >
                    {entry.name}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chapter select — stays as regular dropdown, these are usually small */}
        {entryValue && chapters.length > 0 && (
          <select
            value={segmentValue}
            onChange={(e) => onSegmentChange(e.target.value)}
          >
            <option value="">Entire entry</option>
            {chapters.map((ch) => (
              <option key={ch.slug} value={ch.slug}>
                {ch.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
