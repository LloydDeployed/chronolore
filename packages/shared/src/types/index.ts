// ── Media Hierarchy ──

export interface Universe {
  id: string;
  slug: string;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Series {
  id: string;
  universeId: string;
  slug: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type EntryType = "book" | "movie" | "season" | "game" | "other";

export interface Entry {
  id: string;
  universeId: string;
  seriesId?: string;
  slug: string;
  name: string;
  entryType: EntryType;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type SegmentType = "part" | "chapter" | "episode" | "act" | "other";

export interface Segment {
  id: string;
  entryId: string;
  slug: string;
  name: string;
  segmentType: SegmentType;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ── Reveal Points ──

export interface RevealPoint {
  id: string;
  universeId: string;
  entryId: string;
  segmentId?: string;
}

// ── Progress ──

export interface ProgressState {
  [universeSlug: string]: EntryProgress;
}

export interface EntryProgress {
  [entrySlug: string]: string;
}

// ── Articles ──

export interface ArticleType {
  id: string;
  universeId?: string;
  slug: string;
  name: string;
  icon?: string;
}

export type ArticleStatus = "draft" | "review" | "published" | "rejected";

export interface Article {
  id: string;
  universeId: string;
  articleTypeId: string;
  slug: string;
  title: string;
  introducedAt: string | null; // null = evergreen
  status: ArticleStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Sections & Passages (v2) ──

export interface Section {
  id: string;
  articleId: string;
  heading: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  passages?: Passage[];
}

export type PassageType = "prose" | "quote" | "note";

export interface Passage {
  id: string;
  sectionId: string;
  body: string;
  revealPointId: string | null;
  sortOrder: number;
  status: ArticleStatus;
  passageType: PassageType;
  rejectionReason?: string;
  publishedRevisionId?: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  /** Latest revision (for contributor view) */
  latestRevision?: PassageRevision | null;
  /** Published revision body (for diff display when editing a published passage) */
  publishedBody?: string | null;
}

export interface PassageRevision {
  id: string;
  passageId: string;
  body: string;
  passageType: PassageType;
  status: ArticleStatus;
  rejectionReason?: string;
  createdBy?: string;
  createdAt: string;
  publishedAt?: string | null;
}

// ── Infoboxes (v2) ──

export interface Infobox {
  id: string;
  articleId: string;
  imageUrl?: string;
  status: ArticleStatus;
  rejectionReason?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  fields?: InfoboxField[];
}

export type InfoboxFieldMode = "replace" | "append";

export interface InfoboxField {
  id: string;
  infoboxId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldValue: string;
  mode: InfoboxFieldMode;
  revealPointId: string | null;
  sortOrder: number;
  status: ArticleStatus;
  rejectionReason?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Users ──

export type UserRole = "contributor" | "moderator" | "admin";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

// ── Media Tree (for progress picker) ──

export interface MediaTree {
  universe: Universe;
  series: (Series & {
    entries: (Entry & {
      segments: Segment[];
    })[];
  })[];
  ungrouped: (Entry & {
    segments: Segment[];
  })[];
}
