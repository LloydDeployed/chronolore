import { useState } from "react";
import { createBlock } from "../api/client";
import { RevealPointPicker } from "./RevealPointPicker";

interface Props {
  universeSlug: string;
  articleSlug: string;
  parentId?: string;
  onCreated: () => void;
  onCancel: () => void;
}

const BLOCK_TYPES = [
  { value: "section", label: "Section" },
  { value: "fact", label: "Fact" },
  { value: "quote", label: "Quote" },
];

export function BlockEditor({
  universeSlug,
  articleSlug,
  parentId,
  onCreated,
  onCancel,
}: Props) {
  const [blockType, setBlockType] = useState("fact");
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [revealEntry, setRevealEntry] = useState("");
  const [revealSegment, setRevealSegment] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await createBlock(universeSlug, articleSlug, {
        blockType,
        heading: heading || undefined,
        body: body || undefined,
        parentId,
        sortOrder,
        revealAtEntry: revealEntry,
        revealAtSegment: revealSegment || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="block-editor">
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-field">
            <label>Block Type</label>
            <select
              value={blockType}
              onChange={(e) => setBlockType(e.target.value)}
            >
              {BLOCK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        {(blockType === "section") && (
          <div className="form-field">
            <label>Heading</label>
            <input
              type="text"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="Section heading..."
            />
          </div>
        )}

        <div className="form-field">
          <label>
            Content
            <button
              type="button"
              className="link-btn preview-toggle"
              onClick={() => setPreview(!preview)}
            >
              {preview ? "Edit" : "Preview"}
            </button>
          </label>
          {preview ? (
            <div className="markdown-preview">
              {body || <em>No content</em>}
            </div>
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Write content here (markdown supported)..."
            />
          )}
        </div>

        <RevealPointPicker
          universeSlug={universeSlug}
          label="Revealed At"
          entryValue={revealEntry}
          segmentValue={revealSegment}
          onEntryChange={setRevealEntry}
          onSegmentChange={setRevealSegment}
        />

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Adding..." : "Add Block"}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
