import { useState } from "react";
import { RevealPointPicker } from "../RevealPointPicker";
import { STATUS_COLORS, STATUS_BG, type BookColor } from "./types";
import type { InfoboxField, InfoboxFieldMode } from "@chronolore/shared";

interface RevealPointInfo {
  entrySlug: string;
  entryName: string;
  segmentSlug?: string;
  segmentName?: string;
}

interface FieldWithReveal extends InfoboxField {
  revealPoint?: RevealPointInfo | null;
}

interface InfoboxData {
  id: string;
  imageUrl?: string;
  fields: FieldWithReveal[];
}

interface Props {
  infobox: InfoboxData | null;
  universeSlug: string;
  articleSlug: string;
  bookColorMap: Map<string, BookColor>;
  onReload?: () => void;
  onCreate: () => Promise<void>;
  onUpdateImage: (imageUrl: string) => Promise<void>;
  onDelete: () => void;
  onAddField: (data: {
    fieldKey: string;
    fieldLabel: string;
    fieldValue: string;
    mode: InfoboxFieldMode;
    revealAtEntry?: string;
    revealAtSegment?: string;
  }) => Promise<void>;
  onUpdateField: (fieldId: string, data: {
    fieldKey?: string;
    fieldLabel?: string;
    fieldValue?: string;
    mode?: InfoboxFieldMode;
    revealAtEntry?: string;
    revealAtSegment?: string;
  }) => Promise<void>;
  onDeleteField: (fieldId: string) => void;
}

export function InfoboxEditor({
  infobox,
  universeSlug,
  articleSlug,
  bookColorMap,
  onReload,
  onCreate,
  onUpdateImage,
  onDelete,
  onAddField,
  onUpdateField,
  onDeleteField,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [editingImage, setEditingImage] = useState(false);
  const [imageDraft, setImageDraft] = useState("");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [addingField, setAddingField] = useState(false);
  const [submittedFields, setSubmittedFields] = useState<Set<string>>(new Set());
  const [fieldDraft, setFieldDraft] = useState({
    fieldKey: "",
    fieldLabel: "",
    fieldValue: "",
    mode: "replace" as InfoboxFieldMode,
    revealEntry: "",
    revealSegment: "",
  });

  if (!infobox) {
    return (
      <div className="block-infobox block-infobox--empty">
        <button className="btn-small btn-save" onClick={onCreate}>+ Add Infobox</button>
      </div>
    );
  }

  const editField = (field: FieldWithReveal) => {
    setEditingFieldId(field.id);
    setFieldDraft({
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel,
      fieldValue: field.fieldValue,
      mode: field.mode,
      revealEntry: "",
      revealSegment: "",
    });
  };

  const saveField = async () => {
    if (!editingFieldId) return;
    await onUpdateField(editingFieldId, {
      fieldKey: fieldDraft.fieldKey,
      fieldLabel: fieldDraft.fieldLabel,
      fieldValue: fieldDraft.fieldValue,
      mode: fieldDraft.mode,
      revealAtEntry: fieldDraft.revealEntry || undefined,
      revealAtSegment: fieldDraft.revealSegment || undefined,
    });
    setEditingFieldId(null);
  };

  const addField = async () => {
    if (!fieldDraft.fieldKey.trim() || !fieldDraft.fieldLabel.trim() || !fieldDraft.fieldValue.trim()) return;
    await onAddField({
      fieldKey: fieldDraft.fieldKey,
      fieldLabel: fieldDraft.fieldLabel,
      fieldValue: fieldDraft.fieldValue,
      mode: fieldDraft.mode,
      revealAtEntry: fieldDraft.revealEntry || undefined,
      revealAtSegment: fieldDraft.revealSegment || undefined,
    });
    setAddingField(false);
    setFieldDraft({ fieldKey: "", fieldLabel: "", fieldValue: "", mode: "replace", revealEntry: "", revealSegment: "" });
  };

  const renderFieldForm = (onSave: () => void, onCancel: () => void, label: string) => (
    <div className="block-infobox__field-form">
      <div className="block-infobox__field-form-row">
        <div className="form-field">
          <label>Label</label>
          <input value={fieldDraft.fieldLabel} onChange={(e) => setFieldDraft((d) => ({ ...d, fieldLabel: e.target.value }))} placeholder="e.g. Species" />
        </div>
        <div className="form-field">
          <label>Key</label>
          <input value={fieldDraft.fieldKey} onChange={(e) => setFieldDraft((d) => ({ ...d, fieldKey: e.target.value }))} placeholder="e.g. species" />
        </div>
      </div>
      <div className="form-field">
        <label>Value</label>
        <input value={fieldDraft.fieldValue} onChange={(e) => setFieldDraft((d) => ({ ...d, fieldValue: e.target.value }))} placeholder="e.g. Human" />
      </div>
      <div className="form-field">
        <label>Mode</label>
        <select value={fieldDraft.mode} onChange={(e) => setFieldDraft((d) => ({ ...d, mode: e.target.value as InfoboxFieldMode }))}>
          <option value="replace">Replace</option>
          <option value="append">Append</option>
        </select>
      </div>
      <RevealPointPicker
        universeSlug={universeSlug}
        label="Reveal Point"
        entryValue={fieldDraft.revealEntry}
        segmentValue={fieldDraft.revealSegment}
        onEntryChange={(v) => setFieldDraft((d) => ({ ...d, revealEntry: v }))}
        onSegmentChange={(v) => setFieldDraft((d) => ({ ...d, revealSegment: v }))}
      />
      <div className="block-passage__editor-actions">
        <button className="btn-small btn-save" onClick={onSave}>{label}</button>
        <button className="btn-small btn-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );

  const fields = [...(infobox.fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="block-infobox">
      <div className="block-infobox__header" onClick={() => setExpanded(!expanded)}>
        <span className="block-section__collapse">{expanded ? "▾" : "▸"}</span>
        <h3>Infobox</h3>
        <span className="block-section__count">{fields.length} field{fields.length !== 1 ? "s" : ""}</span>
      </div>

      {expanded && (
        <div className="block-infobox__body">
          {/* Image URL */}
          <div className="block-infobox__image-row">
            <strong>Image: </strong>
            {editingImage ? (
              <>
                <input
                  value={imageDraft}
                  onChange={(e) => setImageDraft(e.target.value)}
                  placeholder="https://..."
                  style={{ width: "280px" }}
                />
                <button className="btn-small btn-save" onClick={async () => { await onUpdateImage(imageDraft); setEditingImage(false); }}>Save</button>
                <button className="btn-small btn-cancel" onClick={() => setEditingImage(false)}>Cancel</button>
              </>
            ) : (
              <span
                onClick={() => { setEditingImage(true); setImageDraft(infobox.imageUrl ?? ""); }}
                style={{ cursor: "pointer" }}
              >
                {infobox.imageUrl || <em>none</em>} <span className="edit-icon">✎</span>
              </span>
            )}
          </div>

          {/* Fields */}
          {fields.map((field) => {
            const bookColor = field.revealPoint?.entrySlug ? bookColorMap.get(field.revealPoint.entrySlug) : undefined;
            const revealLabel = field.revealPoint
              ? field.revealPoint.segmentName
                ? `${field.revealPoint.entryName}, ${field.revealPoint.segmentName}`
                : field.revealPoint.entryName
              : "Evergreen";

            if (editingFieldId === field.id) {
              return <div key={field.id}>{renderFieldForm(saveField, () => setEditingFieldId(null), "Save")}</div>;
            }

            return (
              <div key={field.id} className="block-infobox__field">
                <div className="block-infobox__field-content">
                  <span className="block-infobox__field-label">{field.fieldLabel}</span>
                  <span className="block-infobox__field-value">{field.fieldValue}</span>
                  <span className="block-passage__reveal-tag" style={{ color: bookColor?.color ?? "#78716c", background: bookColor?.bg ?? "#f5f5f4", fontSize: "0.7rem" }}>
                    📖 {revealLabel}
                  </span>
                  {(() => {
                    const effectiveStatus = submittedFields.has(field.id) ? "review" : field.status;
                    return (
                      <span className="block-passage__status" style={{ color: STATUS_COLORS[effectiveStatus], background: STATUS_BG[effectiveStatus], fontSize: "0.65rem" }}>
                        {effectiveStatus}
                      </span>
                    );
                  })()}
                </div>
                <div className="block-infobox__field-actions">
                  {(submittedFields.has(field.id) ? "review" : field.status) === "draft" && (
                    <button className="btn-small" style={{ fontSize: "0.7rem" }} onClick={async () => {
                      try {
                        const { submitInfoboxFieldForReview } = await import("../../api/client");
                        await submitInfoboxFieldForReview(universeSlug, articleSlug, field.id);
                        setSubmittedFields(prev => new Set(prev).add(field.id));
                      } catch (err: any) {
                        console.error("Failed to submit field for review:", err);
                      }
                    }}>📤 Review</button>
                  )}
                  <button className="btn-small btn-edit" onClick={() => editField(field)}>✎</button>
                  <button className="btn-small btn-delete-passage" onClick={() => { if (confirm("Delete this field?")) onDeleteField(field.id); }}>✕</button>
                </div>
              </div>
            );
          })}

          {addingField ? (
            renderFieldForm(addField, () => setAddingField(false), "Add Field")
          ) : (
            <button className="block-add-btn" onClick={() => {
              setAddingField(true);
              setFieldDraft({ fieldKey: "", fieldLabel: "", fieldValue: "", mode: "replace", revealEntry: "", revealSegment: "" });
            }}>
              + Add Field
            </button>
          )}

          <div style={{ marginTop: "0.75rem" }}>
            <button className="btn-small" style={{ background: "#b91c1c", color: "#fff", border: "none" }} onClick={() => { if (confirm("Delete infobox and all fields?")) onDelete(); }}>
              Delete Infobox
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
