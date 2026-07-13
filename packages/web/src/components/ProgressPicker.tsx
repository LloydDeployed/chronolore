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

interface SegmentGroup {
  key: string;
  heading: SegmentNode | null;
  segments: SegmentNode[];
}

const SPECIAL_SEGMENT_RE = /^(prologue|prelude|interlude(?:\s+\d+)?|epilogue|appendix|appendices|ars arcanum)/i;
const NUMBERED_SEGMENT_RE = /^(chapter|episode|act)\s+(\d+)\b/i;

function isStructuralSegment(segment: SegmentNode) {
  return segment.segmentType === "part";
}

function isSpecialNamedSegment(segment: SegmentNode) {
  return SPECIAL_SEGMENT_RE.test(segment.name);
}

function isNumberedSegment(segment: SegmentNode) {
  if (isStructuralSegment(segment) || isSpecialNamedSegment(segment)) return false;
  return NUMBERED_SEGMENT_RE.test(segment.name);
}

function getSegmentButtonLabel(segment: SegmentNode, index: number) {
  const nameMatch = segment.name.match(NUMBERED_SEGMENT_RE);
  const slugMatch = segment.slug.match(/(?:chapter|episode|act)-(\d+)/i);
  return nameMatch?.[2] ?? slugMatch?.[1] ?? String(index + 1);
}

function getTileSpanClass(segment: SegmentNode) {
  if (isNumberedSegment(segment)) return "";
  if (segment.name.length >= 18) return " segment-tile--wide-3";
  return " segment-tile--wide-2";
}

function groupSegments(segments: SegmentNode[]): SegmentGroup[] {
  const groups: SegmentGroup[] = [];
  let currentGroup: SegmentGroup = {
    key: "front-matter",
    heading: null,
    segments: [],
  };

  for (const segment of segments) {
    if (isStructuralSegment(segment)) {
      if (currentGroup.heading || currentGroup.segments.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = {
        key: segment.slug,
        heading: segment,
        segments: [],
      };
      continue;
    }

    currentGroup.segments.push(segment);
  }

  if (currentGroup.heading || currentGroup.segments.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function getPartRangeLabel(group: SegmentGroup) {
  const numbered = group.segments.filter(isNumberedSegment);
  if (numbered.length === 0) return null;

  const first = getSegmentButtonLabel(numbered[0], 0);
  const last = getSegmentButtonLabel(numbered[numbered.length - 1], numbered.length - 1);

  return first === last ? `Ch. ${first}` : `Ch. ${first}–${last}`;
}

export function ProgressPicker({ universeSlug, progress, onEntryChange }: Props) {
  const [tree, setTree] = useState<MediaTree | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`chronolore-progress-expanded:${universeSlug}`);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw) as string[];
      return new Set(parsed);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    getMediaTree(universeSlug).then(setTree);
  }, [universeSlug]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `chronolore-progress-expanded:${universeSlug}`,
        JSON.stringify([...expanded]),
      );
    } catch {
      // Ignore localStorage persistence failures.
    }
  }, [expanded, universeSlug]);

  if (!tree) return <div className="progress-picker">Loading...</div>;

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getOrderedSegments = (entry: EntryNode) =>
    [...entry.segments].sort((a, b) => a.sortOrder - b.sortOrder);

  const getEntryStatus = (entry: EntryNode): "none" | "partial" | "complete" => {
    const val = progress[entry.slug];
    if (!val) return "none";
    if (val === "complete") return "complete";
    return "partial";
  };

  const getCurrentSegSlug = (entry: EntryNode): string | null => {
    const val = progress[entry.slug];
    if (!val || val === "complete") return null;
    return val;
  };

  const getCurrentSegment = (entry: EntryNode): SegmentNode | null => {
    const currentSlug = getCurrentSegSlug(entry);
    if (!currentSlug) return null;
    return entry.segments.find((segment) => segment.slug === currentSlug) ?? null;
  };

  const isSegmentRead = (entry: EntryNode, seg: SegmentNode): boolean => {
    const status = getEntryStatus(entry);
    if (status === "none") return false;
    if (status === "complete") return true;

    const currentSeg = getCurrentSegment(entry);
    if (!currentSeg) return false;
    return seg.sortOrder <= currentSeg.sortOrder;
  };

  const handleEntryToggle = (entry: EntryNode) => {
    const status = getEntryStatus(entry);
    onEntryChange(entry.slug, status === "none" ? "complete" : null);
  };

  const handleSegmentClick = (entry: EntryNode, seg: SegmentNode) => {
    const orderedSegments = getOrderedSegments(entry);
    const segmentIndex = orderedSegments.findIndex((current) => current.slug === seg.slug);
    const currentSlug = getCurrentSegSlug(entry);
    const status = getEntryStatus(entry);
    const isLastSegment = segmentIndex === orderedSegments.length - 1;

    if (isSegmentRead(entry, seg)) {
      if (currentSlug === seg.slug || (status === "complete" && isLastSegment)) {
        if (segmentIndex <= 0) {
          onEntryChange(entry.slug, null);
        } else {
          onEntryChange(entry.slug, orderedSegments[segmentIndex - 1].slug);
        }
      } else {
        onEntryChange(entry.slug, seg.slug);
      }
      return;
    }

    if (isLastSegment) {
      onEntryChange(entry.slug, "complete");
      return;
    }

    onEntryChange(entry.slug, seg.slug);
  };

  const getPreviousReadableSegment = (entry: EntryNode, group: SegmentGroup) => {
    const orderedSegments = getOrderedSegments(entry);
    const firstGroupSegment = group.segments[0];
    if (!firstGroupSegment) return null;

    const firstIndex = orderedSegments.findIndex((segment) => segment.slug === firstGroupSegment.slug);
    for (let index = firstIndex - 1; index >= 0; index -= 1) {
      const candidate = orderedSegments[index];
      if (!isStructuralSegment(candidate)) return candidate;
    }

    return null;
  };

  const getGroupStatus = (entry: EntryNode, group: SegmentGroup): "none" | "partial" | "complete" => {
    if (group.segments.length === 0) return "none";
    const readCount = group.segments.filter((segment) => isSegmentRead(entry, segment)).length;
    if (readCount === 0) return "none";
    if (readCount === group.segments.length) return "complete";
    return "partial";
  };

  const handleGroupToggle = (entry: EntryNode, group: SegmentGroup) => {
    if (group.segments.length === 0) return;

    const groupStatus = getGroupStatus(entry, group);
    if (groupStatus !== "complete") {
      const lastSegment = group.segments[group.segments.length - 1];
      handleSegmentClick(entry, lastSegment);
      return;
    }

    const previousReadable = getPreviousReadableSegment(entry, group);
    onEntryChange(entry.slug, previousReadable ? previousReadable.slug : null);
  };

  const renderSegmentTile = (entry: EntryNode, segment: SegmentNode, numberedIndex: number) => {
    const isRead = isSegmentRead(entry, segment);
    const isNumbered = isNumberedSegment(segment);

    return (
      <button
        key={segment.slug}
        type="button"
        className={`segment-tile${isNumbered ? " segment-button" : " segment-chip"}${isRead ? " is-read" : ""}${getTileSpanClass(segment)}`}
        onClick={() => handleSegmentClick(entry, segment)}
        title={segment.name}
      >
        {isNumbered ? getSegmentButtonLabel(segment, numberedIndex) : segment.name}
      </button>
    );
  };

  const renderGroup = (entry: EntryNode, group: SegmentGroup) => {
    let numberedIndex = 0;
    const groupStatus = getGroupStatus(entry, group);
    const rangeLabel = getPartRangeLabel(group);
    const stateSymbol = groupStatus === "complete" ? "✓" : groupStatus === "partial" ? "−" : "○";

    return (
      <div key={group.key} className={`segment-group-block${group.heading ? " segment-group-block--part" : ""}`}>
        {group.heading && (
          <div className={`segment-part-card segment-part-card--${groupStatus}`}>
            <button
              type="button"
              className="segment-part-header"
              onClick={() => handleGroupToggle(entry, group)}
            >
              <span className="segment-part-header__title">{group.heading.name}</span>
              <span className="segment-part-header__meta">
                {rangeLabel ? <span className="segment-part-header__range">{rangeLabel}</span> : <span className="segment-part-header__range">&nbsp;</span>}
                <span className={`segment-part-header__state-icon segment-part-header__state-icon--${groupStatus}`} aria-label={groupStatus}>
                  {stateSymbol}
                </span>
              </span>
            </button>
          </div>
        )}

        {group.segments.length > 0 && (
          <div className="segment-grid">
            {group.segments.map((segment) => {
              const tile = renderSegmentTile(
                entry,
                segment,
                isNumberedSegment(segment) ? numberedIndex++ : numberedIndex,
              );
              return tile;
            })}
          </div>
        )}
      </div>
    );
  };

  const renderEntry = (entry: EntryNode) => {
    const status = getEntryStatus(entry);
    const orderedSegments = getOrderedSegments(entry);
    const segmentGroups = groupSegments(orderedSegments);
    const isExpanded = expanded.has(entry.slug);
    const currentSegment = getCurrentSegment(entry);

    const summary =
      status === "complete"
        ? "Complete"
        : currentSegment
          ? currentSegment.name
          : "Not started";

    return (
      <div key={entry.slug} className={`entry entry--${status}`}>
        <div className="entry-header">
          <input
            type="checkbox"
            checked={status === "complete"}
            ref={(el) => {
              if (el) el.indeterminate = status === "partial";
            }}
            onChange={() => handleEntryToggle(entry)}
          />
          <button
            type="button"
            className="entry-name-button"
            onClick={() => toggleExpand(entry.slug)}
          >
            <span className="entry-name">{entry.name}</span>
            <span className="entry-summary">{summary}</span>
          </button>
          {orderedSegments.length > 0 && (
            <button
              type="button"
              className={`expand-btn${isExpanded ? " is-expanded" : ""}`}
              onClick={() => toggleExpand(entry.slug)}
              aria-label={isExpanded ? "Collapse entry" : "Expand entry"}
            >
              <span className="expand-btn__chevron" aria-hidden="true" />
            </button>
          )}
        </div>

        {isExpanded && orderedSegments.length > 0 && (
          <div className="entry-progress-panel">
            {segmentGroups.map((group) => renderGroup(entry, group))}
          </div>
        )}
      </div>
    );
  };

  const renderSeries = (series: SeriesNode) => {
    const isExpanded = expanded.has(series.slug);
    const allComplete = series.entries.every((entry) => getEntryStatus(entry) === "complete");
    const anyStarted = series.entries.some((entry) => getEntryStatus(entry) !== "none");

    return (
      <div key={series.slug} className="series">
        <div className="series-header">
          <input
            type="checkbox"
            checked={allComplete}
            ref={(el) => {
              if (el) el.indeterminate = anyStarted && !allComplete;
            }}
            onChange={() => {
              series.entries.forEach((entry) =>
                onEntryChange(entry.slug, allComplete ? null : "complete"),
              );
            }}
          />
          <button
            type="button"
            className="series-name-button"
            onClick={() => toggleExpand(series.slug)}
          >
            <span className="series-name">{series.name}</span>
          </button>
          <button
            type="button"
            className={`expand-btn${isExpanded ? " is-expanded" : ""}`}
            onClick={() => toggleExpand(series.slug)}
            aria-label={isExpanded ? "Collapse series" : "Expand series"}
          >
            <span className="expand-btn__chevron" aria-hidden="true" />
          </button>
        </div>
        {isExpanded && <div className="series-entries">{series.entries.map(renderEntry)}</div>}
      </div>
    );
  };

  return (
    <div className="progress-picker">
      <h3>📖 Your Progress, {tree.universe.name}</h3>
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
