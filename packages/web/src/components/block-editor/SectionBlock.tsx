import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PassageBlock } from "./PassageBlock";
import { NewPassageForm } from "./NewPassageForm";
import { ContainerBlock } from "./ContainerBlock";
import type { BookColor, SectionWithPassages } from "./types";
import type { Passage, PassageType, PassageContainer } from "@chronolore/shared";

interface RevealPointInfo {
  entrySlug: string;
  entryName: string;
  segmentSlug?: string;
  segmentName?: string;
}

interface PassageWithReveal extends Passage {
  revealPoint?: RevealPointInfo | null;
}

interface SectionData {
  id: string;
  articleId: string;
  parentId?: string | null;
  heading: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  passages: PassageWithReveal[];
  containers?: PassageContainer[];
  children?: SectionData[];
}

interface Props {
  section: SectionData;
  depth?: number;
  universeSlug: string;
  bookColorMap: Map<string, BookColor>;
  onUpdateHeading: (sectionId: string, heading: string) => Promise<void>;
  onDeleteSection: (sectionId: string) => void;
  onSavePassage: (passageId: string, data: { body?: string; revealAtEntry?: string; revealAtSegment?: string; containerId?: string | null; containerMeta?: any }) => Promise<void>;
  onDeletePassage: (passageId: string) => void;
  onSubmitForReview: (passageId: string) => void;
  onAddPassage: (sectionId: string, data: { body: string; passageType: PassageType; revealAtEntry?: string; revealAtSegment?: string; containerId?: string; containerMeta?: any }) => Promise<void>;
  onCreateContainer?: (sectionId: string, data: { type: string; title?: string; config?: any; sortOrder?: number }) => Promise<void>;
  onUpdateContainer?: (containerId: string, data: { title?: string; config?: any }) => Promise<void>;
  onDeleteContainer?: (containerId: string) => Promise<void>;
  onAddSubsection: (parentId: string, heading: string) => Promise<void>;
  onMoveSection?: (sectionId: string, newParentId: string | null) => Promise<void>;
  allTopLevelSections?: { id: string; heading: string }[];
}

/** Max depth for subsections: 1=H2, 2=H3, 3=H4 */
const MAX_DEPTH = 3;

export function SectionBlock({
  section,
  depth = 1,
  universeSlug,
  bookColorMap,
  onUpdateHeading,
  onDeleteSection,
  onSavePassage,
  onDeletePassage,
  onSubmitForReview,
  onAddPassage,
  onCreateContainer,
  onUpdateContainer,
  onDeleteContainer,
  onAddSubsection,
  onMoveSection,
  allTopLevelSections,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingHeading, setEditingHeading] = useState(false);
  const [headingDraft, setHeadingDraft] = useState(section.heading);
  const [showNewPassage, setShowNewPassage] = useState(false);
  const [addingToContainer, setAddingToContainer] = useState<string | null>(null);
  const [showNewSubsection, setShowNewSubsection] = useState(false);
  const [newSubsectionHeading, setNewSubsectionHeading] = useState("");

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

  const handleAddSubsection = async () => {
    if (!newSubsectionHeading.trim()) return;
    await onAddSubsection(section.id, newSubsectionHeading.trim());
    setNewSubsectionHeading("");
    setShowNewSubsection(false);
  };

  const passageIds = section.passages.map((p) => p.id);
  const children = section.children ?? [];
  const childIds = children.map((c) => c.id);
  const canAddSubsection = depth < MAX_DEPTH;

  const HeadingEl = (depth === 1 ? "h3" : depth === 2 ? "h4" : "h5") as "h3" | "h4" | "h5";

  const getBookColor = (passage: PassageWithReveal): BookColor | undefined => {
    if (passage.revealPoint?.entrySlug) {
      return bookColorMap.get(passage.revealPoint.entrySlug);
    }
    return undefined;
  };

  const totalPassages = section.passages.length + children.reduce(
    (sum, c) => sum + (c.passages?.length ?? 0), 0
  );

  return (
    <div ref={setNodeRef} style={style} className={`block-section block-section--depth-${depth}`} {...attributes}>
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
          <HeadingEl
            className="block-section__heading"
            onClick={() => { setEditingHeading(true); setHeadingDraft(section.heading); }}
            title="Click to edit"
          >
            {section.heading} <span className="edit-icon">✎</span>
          </HeadingEl>
        )}
        <span className="block-section__count">
          {totalPassages} passage{totalPassages !== 1 ? "s" : ""}
          {children.length > 0 && ` · ${children.length} subsection${children.length !== 1 ? "s" : ""}`}
        </span>
        {depth > 1 && onMoveSection && (
          <button
            className="btn-small"
            onClick={() => onMoveSection(section.id, null)}
            title="Promote to top-level"
          >
            ↑
          </button>
        )}
        <button className="btn-small btn-delete-passage" onClick={() => {
          const msg = totalPassages > 0
            ? `Delete section "${section.heading}"? ${totalPassages} passage(s) and ${children.length} subsection(s) will also be deleted.`
            : `Delete section "${section.heading}"?`;
          if (confirm(msg)) onDeleteSection(section.id);
        }} title="Delete section">✕</button>
      </div>

      {!collapsed && (
        <div className="block-section__body">
          {/* Render containers with their passages */}
          {(section.containers ?? []).map((container) => {
            const containerPassages = section.passages.filter((p) => p.containerId === container.id);
            const containerPassageIds = containerPassages.map((p) => p.id);

            return (
              <ContainerBlock
                key={container.id}
                container={container}
                passageCount={containerPassages.length}
                onUpdate={onUpdateContainer ?? (async () => {})}
                onDelete={(id) => onDeleteContainer?.(id)}
              >
                <SortableContext items={containerPassageIds} strategy={verticalListSortingStrategy}>
                  {containerPassages.map((passage) => (
                    <PassageBlock
                      key={passage.id}
                      passage={passage}
                      universeSlug={universeSlug}
                      bookColor={getBookColor(passage)}
                      onSave={onSavePassage}
                      onDelete={onDeletePassage}
                      onSubmitForReview={onSubmitForReview}
                      container={container}
                    />
                  ))}
                </SortableContext>
                {addingToContainer === container.id ? (
                  <NewPassageForm
                    universeSlug={universeSlug}
                    containerId={container.id}
                    containerType={container.type}
                    containerConfig={container.config}
                    onAdd={async (data) => {
                      await onAddPassage(section.id, { ...data, containerId: container.id, containerMeta: data.containerMeta });
                      setAddingToContainer(null);
                    }}
                    onCancel={() => setAddingToContainer(null)}
                  />
                ) : (
                  <button className="block-add-btn" onClick={() => setAddingToContainer(container.id)}>
                    + Add Passage to {container.type === "paragraph" ? "Paragraph" : "Table"}
                  </button>
                )}
              </ContainerBlock>
            );
          })}

          {/* Render standalone passages (no container) */}
          <SortableContext items={passageIds.filter((id) => {
            const p = section.passages.find((pp) => pp.id === id);
            return !p?.containerId;
          })} strategy={verticalListSortingStrategy}>
            {section.passages
              .filter((p) => !p.containerId)
              .map((passage) => (
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
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <button className="block-add-btn" onClick={() => setShowNewPassage(true)}>
                + Add Passage
              </button>
              {onCreateContainer && (
                <div className="add-container-menu">
                  <button className="block-add-btn" onClick={() => onCreateContainer(section.id, { type: "paragraph", sortOrder: (section.containers?.length ?? 0) })}>
                    + ¶ Paragraph Container
                  </button>
                  <button className="block-add-btn" onClick={() => onCreateContainer(section.id, { type: "table", config: { columns: [{ name: "Column 1", key: "col1" }] }, sortOrder: (section.containers?.length ?? 0) })}>
                    + ▦ Table Container
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Nested subsections */}
          {children.length > 0 && (
            <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
              <div className="block-section__subsections">
                {children.map((child) => (
                  <SectionBlock
                    key={child.id}
                    section={child}
                    depth={depth + 1}
                    universeSlug={universeSlug}
                    bookColorMap={bookColorMap}
                    onUpdateHeading={onUpdateHeading}
                    onDeleteSection={onDeleteSection}
                    onSavePassage={onSavePassage}
                    onDeletePassage={onDeletePassage}
                    onSubmitForReview={onSubmitForReview}
                    onAddPassage={onAddPassage}
                    onAddSubsection={onAddSubsection}
                    onMoveSection={onMoveSection}
                    allTopLevelSections={allTopLevelSections}
                  />
                ))}
              </div>
            </SortableContext>
          )}

          {/* Add Subsection */}
          {canAddSubsection && (
            showNewSubsection ? (
              <div className="block-editor__add-subsection">
                <input
                  type="text"
                  value={newSubsectionHeading}
                  onChange={(e) => setNewSubsectionHeading(e.target.value)}
                  placeholder="Subsection heading..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSubsection();
                    if (e.key === "Escape") setShowNewSubsection(false);
                  }}
                  autoFocus
                />
                <button className="btn-primary btn-sm" onClick={handleAddSubsection}>Add</button>
                <button className="btn-secondary btn-sm" onClick={() => setShowNewSubsection(false)}>Cancel</button>
              </div>
            ) : (
              <button className="block-add-btn block-add-btn--subsection" onClick={() => setShowNewSubsection(true)}>
                + Add Subsection
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
