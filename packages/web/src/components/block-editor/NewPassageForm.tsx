import { useState } from "react";
import { RevealPointPicker } from "../RevealPointPicker";
import { TiptapEditor } from "../TiptapEditor";
import type { PassageType } from "@chronolore/shared";

interface Props {
  universeSlug: string;
  onAdd: (data: { body: string; passageType: PassageType; revealAtEntry?: string; revealAtSegment?: string }) => Promise<void>;
  onCancel: () => void;
}

export function NewPassageForm({ universeSlug, onAdd, onCancel }: Props) {
  const [body, setBody] = useState("");
  const [passageType, setPassageType] = useState<PassageType>("prose");
  const [revealEntry, setRevealEntry] = useState("");
  const [revealSegment, setRevealSegment] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        body: body.trim(),
        passageType,
        revealAtEntry: revealEntry || undefined,
        revealAtSegment: revealSegment || undefined,
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
      <div className="block-passage__editor-actions">
        <button className="btn-small btn-save" onClick={handleAdd} disabled={saving || !body.trim()}>
          {saving ? "Adding..." : "Add Passage"}
        </button>
        <button className="btn-small btn-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
