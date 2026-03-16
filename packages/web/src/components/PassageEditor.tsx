import { useState, useEffect } from "react";
import { createSection, createPassage, getArticle } from "../api/client";
import { RevealPointPicker } from "./RevealPointPicker";
import { TiptapEditor } from "./TiptapEditor";
import type { PassageType, Section } from "@chronolore/shared";

interface Props {
  universeSlug: string;
  articleSlug: string;
  onCreated: () => void;
  onCancel: () => void;
}

const PASSAGE_TYPES: { value: PassageType; label: string }[] = [
  { value: "prose", label: "Prose" },
  { value: "quote", label: "Quote" },
  { value: "note", label: "Note" },
];

export function PassageEditor({
  universeSlug,
  articleSlug,
  onCreated,
  onCancel,
}: Props) {
  const [passageType, setPassageType] = useState<PassageType>("prose");
  const [body, setBody] = useState("");
  const [revealEntry, setRevealEntry] = useState("");
  const [revealSegment, setRevealSegment] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Section selection
  const [existingSections, setExistingSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [newSectionHeading, setNewSectionHeading] = useState("");
  const [createNewSection, setCreateNewSection] = useState(false);

  useEffect(() => {
    getArticle(universeSlug, articleSlug)
      .then((article) => {
        const sections = article.sections ?? [];
        setExistingSections(sections);
        if (sections.length > 0) {
          setSelectedSectionId(sections[0].id);
        } else {
          setCreateNewSection(true);
        }
      })
      .catch(() => {
        setCreateNewSection(true);
      });
  }, [universeSlug, articleSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let sectionId = selectedSectionId;

      if (createNewSection) {
        if (!newSectionHeading.trim()) {
          setError("Section heading is required");
          setLoading(false);
          return;
        }
        const section = await createSection(universeSlug, articleSlug, {
          heading: newSectionHeading.trim(),
        });
        sectionId = section.id;
      }

      if (!sectionId) {
        setError("Please select or create a section");
        setLoading(false);
        return;
      }

      await createPassage(universeSlug, articleSlug, sectionId, {
        body,
        passageType,
        sortOrder,
        revealAtEntry: revealEntry || undefined,
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
    <div className="passage-editor">
      <form onSubmit={handleSubmit}>
        {/* Section picker */}
        <div className="form-field">
          <label>Section</label>
          {existingSections.length > 0 && (
            <div className="section-toggle">
              <label className="inline-label">
                <input
                  type="radio"
                  checked={!createNewSection}
                  onChange={() => setCreateNewSection(false)}
                />
                Existing section
              </label>
              <label className="inline-label">
                <input
                  type="radio"
                  checked={createNewSection}
                  onChange={() => setCreateNewSection(true)}
                />
                New section
              </label>
            </div>
          )}
          {createNewSection ? (
            <input
              type="text"
              value={newSectionHeading}
              onChange={(e) => setNewSectionHeading(e.target.value)}
              placeholder="New section heading..."
            />
          ) : (
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
            >
              {existingSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.heading}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Passage Type</label>
            <select
              value={passageType}
              onChange={(e) => setPassageType(e.target.value as PassageType)}
            >
              {PASSAGE_TYPES.map((t) => (
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

        <div className="form-field">
          <label>Content</label>
          <TiptapEditor content={body} onChange={setBody} editable={true} placeholder="Write your passage here..." />
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
            {loading ? "Adding..." : "Add Passage"}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
