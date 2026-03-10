import { useState, useEffect } from "react";
import { getMediaTree } from "../api/client";
import type { EntryProgress } from "@chronolore/shared";

interface Props {
  universeSlug: string;
  progress: EntryProgress;
  onEntryChange: (entrySlug: string, value: string | null) => void;
}

interface SegmentNode {
  id: string;
  slug: string;
  name: string;
  segmentType: string;
  sortOrder: number;
}

interface EntryNode {
  id: string;
  slug: string;
  name: string;
  entryType: string;
  segments: SegmentNode[];
}

interface SeriesNode {
  id: string;
  slug: string;
  name: string;
  entries: EntryNode[];
}

interface MediaTree {
  universe: { name: string };
  series: SeriesNode[];
  ungrouped: EntryNode[];
}

export function ProgressPicker({ universeSlug, progress, onEntryChange }: Props) {
  const [tree, setTree] = useState<MediaTree | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    getMediaTree(universeSlug).then(setTree);
  }, [universeSlug]);

  if (!tree) return <div className="progress-picker">Loading...</div>;

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getChapters = (entry: EntryNode) =>
    entry.segments.filter((s) => s.segmentType === "chapter");

  const getEntryStatus = (entry: EntryNode): "none" | "partial" | "complete" => {
    const val = progress[entry.slug];
    if (!val) return "none";
    if (val === "complete") return "complete";
    return "partial";
  };

  /** Find which segment slug the reader is currently at */
  const getCurrentSegSlug = (entry: EntryNode): string | null => {
    const val = progress[entry.slug];
    if (!val || val === "complete") return null;
    return val;
  };

  /** Is a given segment within the reader's progress? */
  const isSegmentRead = (entry: EntryNode, seg: SegmentNode): boolean => {
    const status = getEntryStatus(entry);
    if (status === "none") return false;
    if (status === "complete") return true;
    const currentSlug = getCurrentSegSlug(entry);
    if (!currentSlug) return false;
    const currentSeg = entry.segments.find((s) => s.slug === currentSlug);
    if (!currentSeg) return false;
    return seg.sortOrder <= currentSeg.sortOrder;
  };

  const handleEntryToggle = (entry: EntryNode) => {
    const status = getEntryStatus(entry);
    onEntryChange(entry.slug, status === "none" ? "complete" : null);
  };

  const handleChapterClick = (entry: EntryNode, seg: SegmentNode) => {
    const chapters = getChapters(entry);
    const lastChapter = chapters[chapters.length - 1];

    if (isSegmentRead(entry, seg)) {
      // Clicking a read segment — uncheck from this point
      const currentSlug = getCurrentSegSlug(entry);
      if (currentSlug === seg.slug || (getEntryStatus(entry) === "complete" && seg === lastChapter)) {
        // Uncheck this one — go to previous chapter
        const idx = chapters.indexOf(seg);
        if (idx <= 0) {
          onEntryChange(entry.slug, null);
        } else {
          onEntryChange(entry.slug, chapters[idx - 1].slug);
        }
      } else {
        // Clicked an earlier segment — set progress to it
        onEntryChange(entry.slug, seg.slug);
      }
    } else {
      // Check this segment — if it's the last chapter, mark complete
      if (seg === lastChapter) {
        onEntryChange(entry.slug, "complete");
      } else {
        onEntryChange(entry.slug, seg.slug);
      }
    }
  };

  const renderEntry = (entry: EntryNode) => {
    const status = getEntryStatus(entry);
    const chapters = getChapters(entry);
    const isExpanded = expanded.has(entry.slug);
    const currentSlug = getCurrentSegSlug(entry);

    const currentChapter = currentSlug
      ? chapters.find((c) => c.slug === currentSlug)
      : null;

    const summary =
      status === "complete"
        ? "✓"
        : currentChapter
          ? `${currentChapter.name} / ${chapters.length}`
          : "";

    return (
      <div key={entry.slug} className="entry">
        <div className="entry-header">
          <input
            type="checkbox"
            checked={status === "complete"}
            ref={(el) => {
              if (el) el.indeterminate = status === "partial";
            }}
            onChange={() => handleEntryToggle(entry)}
          />
          <span
            className="entry-name"
            onClick={() => toggleExpand(entry.slug)}
            style={{ cursor: "pointer" }}
          >
            {entry.name}
          </span>
          {summary && <span className="entry-summary">{summary}</span>}
          {chapters.length > 0 && (
            <button
              className="expand-btn"
              onClick={() => toggleExpand(entry.slug)}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          )}
        </div>
        {isExpanded && chapters.length > 0 && (
          <div className="chapters">
            {chapters.map((ch) => (
              <label key={ch.slug} className="chapter">
                <input
                  type="checkbox"
                  checked={isSegmentRead(entry, ch)}
                  onChange={() => handleChapterClick(entry, ch)}
                />
                {ch.name}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSeries = (s: SeriesNode) => {
    const isExpanded = expanded.has(s.slug);
    const allComplete = s.entries.every(
      (e) => getEntryStatus(e) === "complete",
    );
    const anyStarted = s.entries.some((e) => getEntryStatus(e) !== "none");

    return (
      <div key={s.slug} className="series">
        <div className="series-header">
          <input
            type="checkbox"
            checked={allComplete}
            ref={(el) => {
              if (el) el.indeterminate = anyStarted && !allComplete;
            }}
            onChange={() => {
              s.entries.forEach((e) =>
                onEntryChange(e.slug, allComplete ? null : "complete"),
              );
            }}
          />
          <span
            className="series-name"
            onClick={() => toggleExpand(s.slug)}
            style={{ cursor: "pointer", fontWeight: "bold" }}
          >
            {s.name}
          </span>
          <button
            className="expand-btn"
            onClick={() => toggleExpand(s.slug)}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        </div>
        {isExpanded && (
          <div className="series-entries">
            {s.entries.map(renderEntry)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="progress-picker">
      <h3>📖 Your Progress — {tree.universe.name}</h3>
      {tree.series.map(renderSeries)}
      {tree.ungrouped.length > 0 && (
        <div className="ungrouped">
          <h4>Other</h4>
          {tree.ungrouped.map(renderEntry)}
        </div>
      )}
    </div>
  );
}
