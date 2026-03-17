import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SectionBlock } from "./SectionBlock";
import { InfoboxEditor } from "./InfoboxEditor";
import { useBookColors } from "./useBookColors";
import type { BookColor } from "./types";
import type { Article, Passage, PassageType, InfoboxFieldMode } from "@chronolore/shared";
import {
  createSection,
  updateSection,
  deleteSection,
  createPassage,
  updatePassage,
  deletePassage,
  submitPassageForReview,
  createInfobox,
  updateInfobox,
  deleteInfobox,
  createInfoboxField,
  updateInfoboxField,
  deleteInfoboxField,
  batchReorder,
} from "../../api/client";

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
  children?: SectionData[];
}

interface InfoboxFieldWithReveal {
  id: string;
  infoboxId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldValue: string;
  mode: InfoboxFieldMode;
  revealPointId: string | null;
  sortOrder: number;
  status: string;
  revealPoint?: RevealPointInfo | null;
  [key: string]: any;
}

interface InfoboxData {
  id: string;
  imageUrl?: string;
  fields: InfoboxFieldWithReveal[];
}

interface Props {
  article: Article;
  articleType?: { name: string; icon: string };
  sections: SectionData[];
  infobox: InfoboxData | null;
  universeSlug: string;
  articleSlug: string;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}

/** Flatten a nested section tree to find sections at all levels */
function flattenSections(sections: SectionData[]): SectionData[] {
  const result: SectionData[] = [];
  for (const s of sections) {
    result.push(s);
    if (s.children) result.push(...flattenSections(s.children));
  }
  return result;
}

export function BlockEditor({
  article,
  sections: initialSections,
  infobox,
  universeSlug,
  articleSlug,
  onReload,
  onError,
}: Props) {
  const [newSectionHeading, setNewSectionHeading] = useState("");
  const { colorMap } = useBookColors(universeSlug);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sectionIds = initialSections.map((s) => s.id);
  const allFlat = flattenSections(initialSections);

  // Determine if a dragged item is a section or passage
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if it's a top-level section being reordered
    const activeSectionIdx = initialSections.findIndex((s) => s.id === activeId);
    const overSectionIdx = initialSections.findIndex((s) => s.id === overId);

    if (activeSectionIdx !== -1 && overSectionIdx !== -1) {
      const newSections = [...initialSections];
      const [moved] = newSections.splice(activeSectionIdx, 1);
      newSections.splice(overSectionIdx, 0, moved);

      try {
        await batchReorder(universeSlug, articleSlug, {
          sectionOrder: newSections.map((s, i) => ({ id: s.id, sortOrder: i })),
        });
        await onReload();
      } catch (err: any) {
        onError(err.message);
      }
      return;
    }

    // Check subsection reorder within same parent
    for (const section of allFlat) {
      const children = section.children ?? [];
      const activeChildIdx = children.findIndex((c) => c.id === activeId);
      const overChildIdx = children.findIndex((c) => c.id === overId);

      if (activeChildIdx !== -1 && overChildIdx !== -1) {
        const newChildren = [...children];
        const [moved] = newChildren.splice(activeChildIdx, 1);
        newChildren.splice(overChildIdx, 0, moved);

        try {
          await batchReorder(universeSlug, articleSlug, {
            sectionOrder: newChildren.map((c, i) => ({ id: c.id, sortOrder: i })),
          });
          await onReload();
        } catch (err: any) {
          onError(err.message);
        }
        return;
      }
    }

    // Passage reorder within same section
    for (const section of allFlat) {
      const activePassIdx = section.passages.findIndex((p) => p.id === activeId);
      const overPassIdx = section.passages.findIndex((p) => p.id === overId);

      if (activePassIdx !== -1 && overPassIdx !== -1) {
        const newPassages = [...section.passages];
        const [moved] = newPassages.splice(activePassIdx, 1);
        newPassages.splice(overPassIdx, 0, moved);

        try {
          await batchReorder(universeSlug, articleSlug, {
            passageOrder: newPassages.map((p, i) => ({ id: p.id, sortOrder: i })),
          });
          await onReload();
        } catch (err: any) {
          onError(err.message);
        }
        return;
      }
    }
  }, [initialSections, allFlat, universeSlug, articleSlug, onReload, onError]);

  const handleAddSection = async () => {
    if (!newSectionHeading.trim()) return;
    try {
      const maxSort = initialSections.reduce((m, s) => Math.max(m, s.sortOrder), -1);
      await createSection(universeSlug, articleSlug, {
        heading: newSectionHeading.trim(),
        sortOrder: maxSort + 1,
      });
      setNewSectionHeading("");
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleAddSubsection = async (parentId: string, heading: string) => {
    try {
      const parent = allFlat.find((s) => s.id === parentId);
      const siblings = parent?.children ?? [];
      const maxSort = siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1);
      await createSection(universeSlug, articleSlug, {
        heading,
        sortOrder: maxSort + 1,
        parentId,
      });
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleMoveSection = async (sectionId: string, newParentId: string | null) => {
    try {
      await updateSection(universeSlug, articleSlug, sectionId, { parentId: newParentId });
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleUpdateHeading = async (sectionId: string, heading: string) => {
    try {
      await updateSection(universeSlug, articleSlug, sectionId, { heading });
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      await deleteSection(universeSlug, articleSlug, sectionId);
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleSavePassage = async (passageId: string, data: { body?: string; revealAtEntry?: string; revealAtSegment?: string }) => {
    try {
      await updatePassage(universeSlug, articleSlug, passageId, data);
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleDeletePassage = async (passageId: string) => {
    if (!confirm("Delete this passage?")) return;
    try {
      await deletePassage(universeSlug, articleSlug, passageId);
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleSubmitForReview = async (passageId: string) => {
    try {
      await submitPassageForReview(universeSlug, articleSlug, passageId);
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleAddPassage = async (sectionId: string, data: { body: string; passageType: PassageType; revealAtEntry?: string; revealAtSegment?: string }) => {
    try {
      const section = allFlat.find((s) => s.id === sectionId);
      const maxSort = (section?.passages ?? []).reduce((m, p) => Math.max(m, p.sortOrder), -1);
      await createPassage(universeSlug, articleSlug, sectionId, {
        body: data.body,
        passageType: data.passageType,
        sortOrder: maxSort + 1,
        revealAtEntry: data.revealAtEntry,
        revealAtSegment: data.revealAtSegment,
      });
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  // Infobox handlers
  const handleCreateInfobox = async () => {
    try {
      await createInfobox(universeSlug, articleSlug, {});
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleUpdateImage = async (imageUrl: string) => {
    try {
      await updateInfobox(universeSlug, articleSlug, { imageUrl: imageUrl || undefined });
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleDeleteInfobox = async () => {
    try {
      await deleteInfobox(universeSlug, articleSlug);
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleAddField = async (data: {
    fieldKey: string;
    fieldLabel: string;
    fieldValue: string;
    mode: InfoboxFieldMode;
    revealAtEntry?: string;
    revealAtSegment?: string;
  }) => {
    try {
      const fields = infobox?.fields ?? [];
      const maxSort = fields.reduce((m, f) => Math.max(m, f.sortOrder), -1);
      await createInfoboxField(universeSlug, articleSlug, {
        ...data,
        sortOrder: maxSort + 1,
      });
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleUpdateField = async (fieldId: string, data: any) => {
    try {
      await updateInfoboxField(universeSlug, articleSlug, fieldId, data);
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      await deleteInfoboxField(universeSlug, articleSlug, fieldId);
      await onReload();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const topLevelSectionInfo = initialSections.map((s) => ({ id: s.id, heading: s.heading }));

  return (
    <div className="block-editor">
      {/* Infobox */}
      <InfoboxEditor
        infobox={infobox as any}
        universeSlug={universeSlug}
        articleSlug={articleSlug}
        bookColorMap={colorMap}
        onReload={onReload}
        onCreate={handleCreateInfobox}
        onUpdateImage={handleUpdateImage}
        onDelete={handleDeleteInfobox}
        onAddField={handleAddField}
        onUpdateField={handleUpdateField}
        onDeleteField={handleDeleteField}
      />

      {/* Sections with DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          <div className="block-editor__sections">
            {initialSections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                depth={1}
                universeSlug={universeSlug}
                bookColorMap={colorMap}
                onUpdateHeading={handleUpdateHeading}
                onDeleteSection={handleDeleteSection}
                onSavePassage={handleSavePassage}
                onDeletePassage={handleDeletePassage}
                onSubmitForReview={handleSubmitForReview}
                onAddPassage={handleAddPassage}
                onAddSubsection={handleAddSubsection}
                onMoveSection={handleMoveSection}
                allTopLevelSections={topLevelSectionInfo}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Section */}
      <div className="block-editor__add-section">
        <input
          type="text"
          value={newSectionHeading}
          onChange={(e) => setNewSectionHeading(e.target.value)}
          placeholder="New section heading..."
          onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
        />
        <button className="btn-primary" onClick={handleAddSection}>+ Add Section</button>
      </div>
    </div>
  );
}
