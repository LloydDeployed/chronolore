import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createArticle } from "../api/client";
import { RevealPointPicker } from "./RevealPointPicker";

interface Props {
  universeSlug: string;
  onClose: () => void;
}

const ARTICLE_TYPES = [
  { slug: "character", label: "👤 Character" },
  { slug: "location", label: "📍 Location" },
  { slug: "event", label: "⚡ Event" },
  { slug: "organization", label: "🏛️ Organization" },
  { slug: "item", label: "🔮 Item" },
  { slug: "concept", label: "💡 Concept" },
];

export function CreateArticle({ universeSlug, onClose }: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [typeSlug, setTypeSlug] = useState("character");
  const [introEntry, setIntroEntry] = useState("");
  const [introSegment, setIntroSegment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    // Auto-generate slug from title
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-"),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const article = await createArticle(universeSlug, {
        title,
        slug,
        articleTypeSlug: typeSlug,
        introducedAtEntry: introEntry,
        introducedAtSegment: introSegment || undefined,
      });
      navigate(`/${universeSlug}/articles/${article.slug}/edit`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Article</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
              autoFocus
              placeholder="e.g., Sazed"
            />
          </div>

          <div className="form-field">
            <label>Slug (URL-friendly)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              placeholder="e.g., sazed"
            />
          </div>

          <div className="form-field">
            <label>Type</label>
            <select
              value={typeSlug}
              onChange={(e) => setTypeSlug(e.target.value)}
            >
              {ARTICLE_TYPES.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <RevealPointPicker
            universeSlug={universeSlug}
            label="First Appears At"
            entryValue={introEntry}
            segmentValue={introSegment}
            onEntryChange={setIntroEntry}
            onSegmentChange={setIntroSegment}
          />

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Create Article"}
          </button>
        </form>
      </div>
    </div>
  );
}
