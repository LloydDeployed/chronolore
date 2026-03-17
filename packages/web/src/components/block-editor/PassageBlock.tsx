import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RevealPointPicker } from "../RevealPointPicker";
import { TiptapEditor } from "../TiptapEditor";
import { TiptapRenderer, extractText } from "../TiptapRenderer";
import { STATUS_COLORS, STATUS_BG, type BookColor } from "./types";
import type { Passage, PassageType, PassageContainer, PassageContainerColumn } from "@chronolore/shared";

interface RevealPointInfo {
  entrySlug: string;
  entryName: string;
  segmentSlug?: string;
  segmentName?: string;
}

interface PassageWithReveal extends Passage {
  revealPoint?: RevealPointInfo | null;
  publishedBody?: string | null;
}

interface Props {
  passage: PassageWithReveal;
  universeSlug: string;
  bookColor?: BookColor;
  onSave: (id: string, data: { body?: string; revealAtEntry?: string; revealAtSegment?: string; containerId?: string | null; containerMeta?: any }) => Promise<void>;
  onDelete: (id: string) => void;
  onSubmitForReview: (id: string) => void;
  container?: PassageContainer;
}

const TYPE_LABELS: Record<string, string> = {
  prose: "Prose",
  quote: "Quote",
  note: "Note",
};

export function PassageBlock({ passage, universeSlug, bookColor, onSave, onDelete, onSubmitForReview, container }: Props) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(passage.body);
  const [passageType, setPassageType] = useState<PassageType>(passage.passageType);
  const [revealEntry, setRevealEntry] = useState("");
  const [revealSegment, setRevealSegment] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: passage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeftColor: bookColor?.color ?? "#d4d4d4",
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(passage.id, {
        body,
        revealAtEntry: revealEntry || undefined,
        revealAtSegment: revealSegment || undefined,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const revealLabel = passage.revealPoint
    ? passage.revealPoint.segmentName
      ? `${passage.revealPoint.entryName}, ${passage.revealPoint.segmentName}`
      : passage.revealPoint.entryName
    : "Evergreen";

  // Detect if there's a pending edit on a published passage
  const hasPendingEdit = passage.status === "published" &&
    passage.publishedBody != null &&
    passage.publishedBody !== passage.body;
  const latestRevisionStatus = passage.latestRevision?.status;

  if (editing) {
    return (
      <div ref={setNodeRef} style={style} className="block-passage block-passage--editing" {...attributes}>
        <div className="block-passage__editor">
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
            <TiptapEditor content={body} onChange={setBody} editable={true} />
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
            <button className="btn-small btn-save" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button className="btn-small btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="block-passage" {...attributes}>
      <div className="block-passage__header">
        <button className="block-drag-handle" {...listeners} title="Drag to reorder">⠿</button>
        <span className="block-passage__reveal-tag" style={{ color: bookColor?.color ?? "#78716c", background: bookColor?.bg ?? "#f5f5f4" }}>
          📖 {revealLabel}
        </span>
        <span
          className="block-passage__status"
          style={{ color: STATUS_COLORS[passage.status], background: STATUS_BG[passage.status] }}
        >
          {passage.status}
        </span>
        <span className="block-passage__type-tag">
          {TYPE_LABELS[passage.passageType] ?? passage.passageType}
        </span>
      </div>
      {hasPendingEdit && (
        <div className="block-passage__pending-edit" style={{
          background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "4px",
          padding: "4px 8px", margin: "4px 0", fontSize: "0.8em", color: "#92400e",
        }}>
          ✏️ Pending edit ({latestRevisionStatus ?? "draft"}) — published version still live
        </div>
      )}
      {container?.type === "table" && (
        <div className="container-meta-editor">
          <label>Row:</label>
          <input
            type="number"
            value={(passage.containerMeta as any)?.row ?? 0}
            style={{ width: "50px" }}
            onChange={(e) => {
              const row = parseInt(e.target.value) || 0;
              onSave(passage.id, { containerMeta: { ...(passage.containerMeta ?? {}), row } });
            }}
          />
          <label>Column:</label>
          <select
            value={(passage.containerMeta as any)?.column ?? ""}
            onChange={(e) => {
              onSave(passage.id, { containerMeta: { ...(passage.containerMeta ?? {}), column: e.target.value } });
            }}
          >
            <option value="">—</option>
            {((container.config as any)?.columns ?? []).map((col: PassageContainerColumn) => (
              <option key={col.key} value={col.key}>{col.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="block-passage__body">
        {extractText(passage.body, 200) || <TiptapRenderer content={passage.body} />}
      </div>
      <div className="block-passage__actions">
        <button className="btn-small btn-edit" onClick={() => {
          setEditing(true);
          setBody(passage.body);
          setPassageType(passage.passageType);
          setRevealEntry("");
          setRevealSegment("");
        }}>
          ✏️ Edit
        </button>
        {(passage.status === "draft" || (hasPendingEdit && latestRevisionStatus === "draft")) && (
          <button className="btn-small btn-review" onClick={() => onSubmitForReview(passage.id)}>
            📤 Submit for Review
          </button>
        )}
        <button className="btn-small btn-delete-passage" onClick={() => onDelete(passage.id)} title="Delete">
          ✕
        </button>
      </div>
    </div>
  );
}
