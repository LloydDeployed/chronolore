import { useState, useEffect } from "react";
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

export function RevealPointPicker({
  universeSlug,
  label,
  entryValue,
  segmentValue,
  onEntryChange,
  onSegmentChange,
}: Props) {
  const [tree, setTree] = useState<{
    series: SeriesNode[];
    ungrouped: EntryNode[];
  } | null>(null);

  useEffect(() => {
    getMediaTree(universeSlug).then(setTree);
  }, [universeSlug]);

  if (!tree) return <div>Loading...</div>;

  const allEntries = [
    ...tree.series.flatMap((s) => s.entries),
    ...tree.ungrouped,
  ];

  const selectedEntry = allEntries.find((e) => e.slug === entryValue);
  const chapters = selectedEntry?.segments.filter(
    (s) => s.segmentType === "chapter",
  ) ?? [];

  return (
    <div className="reveal-picker">
      <label className="form-label">{label}</label>
      <div className="reveal-picker-selects">
        <select
          value={entryValue}
          onChange={(e) => {
            onEntryChange(e.target.value);
            onSegmentChange("");
          }}
        >
          <option value="">Select book/entry...</option>
          {tree.series.map((s) => (
            <optgroup key={s.name} label={s.name}>
              {s.entries.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ))}
          {tree.ungrouped.map((e) => (
            <option key={e.slug} value={e.slug}>
              {e.name}
            </option>
          ))}
        </select>

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
