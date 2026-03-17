import { useState } from "react";
import { RevealPointPicker } from "../RevealPointPicker";
import { TiptapEditor } from "../TiptapEditor";
import type { PassageType, PassageContainerConfig, PassageContainerColumn } from "@chronolore/shared";

interface Props {
  universeSlug: string;
  containerId?: string;
  containerType?: string;
  containerConfig?: PassageContainerConfig;
  onAdd: (data: { body: string; passageType: PassageType; revealAtEntry?: string; revealAtSegment?: string; containerMeta?: any }) => Promise<void>;
  onCancel: () => void;
}

export function NewPassageForm({ universeSlug, containerId, containerType, containerConfig, onAdd, onCancel }: Props) {
  const [body, setBody] = useState("");
  const [passageType, setPassageType] = useState<PassageType>("prose");
  const [revealEntry, setRevealEntry] = useState("");
  const [revealSegment, setRevealSegment] = useState("");
  const [saving, setSaving] = useState(false);
  const [metaRow, setMetaRow] = useState(0);
  const [metaColumn, setMetaColumn] = useState("");

  const columns: PassageContainerColumn[] = containerConfig?.columns ?? [];

  const handleAdd = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const containerMeta = containerType === "table"
        ? { row: metaRow, column: metaColumn }
        : undefined;
      await onAdd({
        body: body.trim(),
        passageType,
        revealAtEntry: revealEntry || undefined,
        revealAtSegment: revealSegment || undefined,
        containerMeta,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="block-new-passage">
      <div className="form-field">
        <label>Type</label>
        <select value={passageType} onChange={(e) => setPassageType(e.target.value as PassageType)}>
          <option value="prose">Prose</option>
          <option value="quote">Quote</option>
          <option value="note">Note</option>
        </select>
      </div>
      <div className="form-field">
        <label>Body</label>
        <TiptapEditor content={body} onChange={setBody} editable={true} placeholder="Write your passage..." />
      </div>
      <RevealPointPicker
        universeSlug={universeSlug}
        label="Reveal Point"
        entryValue={revealEntry}
        segmentValue={revealSegment}
        onEntryChange={setRevealEntry}
        onSegmentChange={setRevealSegment}
      />
      {containerType === "table" && columns.length > 0 && (
        <div className="container-meta-editor" style={{ marginBottom: "0.5rem" }}>
          <label>Row:</label>
          <input type="number" value={metaRow} onChange={(e) => setMetaRow(parseInt(e.target.value) || 0)} style={{ width: "50px" }} />
          <label>Column:</label>
          <select value={metaColumn} onChange={(e) => setMetaColumn(e.target.value)}>
            <option value="">—</option>
            {columns.map((col) => (
              <option key={col.key} value={col.key}>{col.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="block-passage__editor-actions">
        <button className="btn-small btn-save" onClick={handleAdd} disabled={saving || !body.trim()}>
          {saving ? "Adding..." : "Add Passage"}
        </button>
        <button className="btn-small btn-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
