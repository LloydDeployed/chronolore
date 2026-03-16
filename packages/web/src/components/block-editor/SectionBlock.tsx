import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PassageBlock } from "./PassageBlock";
import { NewPassageForm } from "./NewPassageForm";
import type { BookColor, SectionWithPassages } from "./types";
import type { Passage, PassageType } from "@chronolore/shared";

interface RevealPointInfo {
  entrySlug: string;
  entryName: string;
  segmentSlug?: string;
  segmentName?: string;
}

interface PassageWithReveal extends Passage {
  revealPoint?: RevealPointInfo | null;
}

interface SectionWithRevealPassages extends Omit<SectionWithPassages, "passages"> {
  passages: PassageWithReveal[];
}

interface Props {
  section: SectionWithRevealPassages;
  universeSlug: string;
  bookColorMap: Map<string, BookColor>;
  onUpdateHeading: (sectionId: string, heading: string) => Promise<void>;
  onDeleteSection: (sectionId: string) => void;
  onSavePassage: (passageId: string, data: { body?: string; revealAtEntry?: string; revealAtSegment?: string }) => Promise<void>;
  onDeletePassage: (passageId: string) => void;
  onSubmitForReview: (passageId: string) => void;
  onAddPassage: (sectionId: string, data: { body: string; passageType: PassageType; revealAtEntry?: string; revealAtSegment?: string }) => Promise<void>;
}

export function SectionBlock({
  section,
  universeSlug,
  bookColorMap,
  onUpdateHeading,
  onDeleteSection,
  onSavePassage,
  onDeletePassage,
  onSubmitForReview,
  onAddPassage,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingHeading, setEditingHeading] = useState(false);
  const [headingDraft, setHeadingDraft] = useState(section.heading);
  const [showNewPassage, setShowNewPassage] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const saveHeading = async () => {
    if (headingDraft.trim() && headingDraft.trim() !== section.heading) {
      await onUpdateHeading(section.id, headingDraft.trim());
    }
    setEditingHeading(false);
  };

  const passageIds = section.passages.map((p) => p.id);

  const getBookColor = (passage: PassageWithReveal): BookColor | undefined => {
    if (passage.revealPoint?.entrySlug) {
      return bookColorMap.get(passage.revealPoint.entrySlug);
    }
    return undefined;
  };

  return (
    <div ref={setNodeRef} style={style} className="block-section" {...attributes}>
      <div className="block-section__header">
        <button className="block-drag-handle block-drag-handle--section" {...listeners} title="Drag to reorder section">
          ⠿
        </button>
        <button className="block-section__collapse" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "▸" : "▾"}
        </button>
        {editingHeading ? (
          <input
            className="block-section__heading-input"
            value={headingDraft}
            onChange={(e) => setHeadingDraft(e.target.value)}
            onBlur={saveHeading}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveHeading();
              if (e.key === "Escape") setEditingHeading(false);
            }}
            autoFocus
          />
        ) : (
          <h3
            className="block-section__heading"
            onClick={() => { setEditingHeading(true); setHeadingDraft(section.heading); }}
            title="Click to edit"
          >
            {section.heading} <span className="edit-icon">✎</span>
          </h3>
        )}
        <span className="block-section__count">{section.passages.length} passage{section.passages.length !== 1 ? "s" : ""}</span>
        <button className="btn-small btn-delete-passage" onClick={() => {
          const msg = section.passages.length > 0
            ? `Delete section "${section.heading}"? ${section.passages.length} passage(s) will also be deleted.`
            : `Delete section "${section.heading}"?`;
          if (confirm(msg)) onDeleteSection(section.id);
        }} title="Delete section">✕</button>
      </div>

      {!collapsed && (
        <div className="block-section__body">
          <SortableContext items={passageIds} strategy={verticalListSortingStrategy}>
            {section.passages.map((passage) => (
              <PassageBlock
                key={passage.id}
                passage={passage}
                universeSlug={universeSlug}
                bookColor={getBookColor(passage)}
                onSave={onSavePassage}
                onDelete={onDeletePassage}
                onSubmitForReview={onSubmitForReview}
              />
            ))}
          </SortableContext>

          {showNewPassage ? (
            <NewPassageForm
              universeSlug={universeSlug}
              onAdd={async (data) => {
                await onAddPassage(section.id, data);
                setShowNewPassage(false);
              }}
              onCancel={() => setShowNewPassage(false)}
            />
          ) : (
            <button className="block-add-btn" onClick={() => setShowNewPassage(true)}>
              + Add Passage
            </button>
          )}
        </div>
      )}
    </div>
  );
}
