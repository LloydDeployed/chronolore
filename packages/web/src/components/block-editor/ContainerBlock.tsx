import { useState } from "react";
import type { PassageContainer, PassageContainerColumn } from "@chronolore/shared";

interface Props {
  container: PassageContainer;
  passageCount: number;
  onUpdate: (containerId: string, data: { title?: string; config?: any }) => Promise<void>;
  onDelete: (containerId: string) => void;
  children: React.ReactNode;
}

export function ContainerBlock({ container, passageCount, onUpdate, onDelete, children }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(container.title ?? "");
  const [editingColumns, setEditingColumns] = useState(false);

  const columns: PassageContainerColumn[] =
    (container.config as any)?.columns ?? [];

  const saveTitle = async () => {
    const newTitle = titleDraft.trim() || undefined;
    if (newTitle !== (container.title ?? undefined)) {
      await onUpdate(container.id, { title: newTitle });
    }
    setEditingTitle(false);
  };

  const handleDeleteColumn = async (idx: number) => {
    const newCols = columns.filter((_, i) => i !== idx);
    await onUpdate(container.id, { config: { columns: newCols } });
  };

  const handleAddColumn = async () => {
    const name = prompt("Column name:");
    if (!name) return;
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const newCols = [...columns, { name, key }];
    await onUpdate(container.id, { config: { columns: newCols } });
  };

  const handleRenameColumn = async (idx: number) => {
    const col = columns[idx];
    const name = prompt("New column name:", col.name);
    if (!name || name === col.name) return;
    const newCols = [...columns];
    newCols[idx] = { ...col, name };
    await onUpdate(container.id, { config: { columns: newCols } });
  };

  return (
    <div className="block-container">
      <div className="block-container__header">
        <span className={`block-container__type-badge block-container__type-badge--${container.type}`}>
          {container.type === "paragraph" ? "¶ Paragraph" : "▦ Table"}
        </span>

        {editingTitle ? (
          <input
            className="block-container__title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            placeholder="Container title (optional)"
            autoFocus
          />
        ) : (
          <span
            style={{ cursor: "pointer", flex: 1, fontWeight: 500 }}
            onClick={() => { setEditingTitle(true); setTitleDraft(container.title ?? ""); }}
            title="Click to edit title"
          >
            {container.title || <em style={{ color: "#9ca3af" }}>No title</em>}
            {" "}<span className="edit-icon" style={{ fontSize: "0.75rem" }}>✎</span>
          </span>
        )}

        <span style={{ fontSize: "0.75rem", color: "#78716c" }}>
          {passageCount} passage{passageCount !== 1 ? "s" : ""}
        </span>

        {container.type === "table" && (
          <button
            className="btn-small"
            onClick={() => setEditingColumns(!editingColumns)}
            title="Edit columns"
          >
            📊 Columns
          </button>
        )}

        <button
          className="btn-small btn-delete-passage"
          onClick={() => {
            if (confirm(`Delete this ${container.type} container? Passages will become standalone.`)) {
              onDelete(container.id);
            }
          }}
          title="Delete container"
        >
          ✕
        </button>
      </div>

      {/* Table column editor */}
      {container.type === "table" && editingColumns && (
        <div className="block-container__columns">
          {columns.map((col, i) => (
            <div key={col.key} className="block-container__column-row">
              <span style={{ fontWeight: 500 }}>{col.name}</span>
              <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>({col.key})</span>
              <button className="btn-small" onClick={() => handleRenameColumn(i)} title="Rename">✎</button>
              <button className="btn-small btn-delete-passage" onClick={() => handleDeleteColumn(i)} title="Remove">✕</button>
            </div>
          ))}
          <button className="btn-small" onClick={handleAddColumn}>+ Add Column</button>
        </div>
      )}

      <div className="block-container__body">
        {children}
      </div>
    </div>
  );
}
