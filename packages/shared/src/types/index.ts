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

/** Client-side progress: flat map of entry slugs to segment progress */
export interface ProgressState {
  [universeSlug: string]: EntryProgress;
}

export interface EntryProgress {
  [entrySlug: string]: number | "complete";
}

// ── Articles ──

export interface ArticleType {
  id: string;
  universeId?: string;
  slug: string;
  name: string;
  icon?: string;
}

export type ArticleStatus = "draft" | "review" | "published";

export interface Article {
  id: string;
  universeId: string;
  articleTypeId: string;
  slug: string;
  title: string;
  introducedAt: string; // reveal point ID
  status: ArticleStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type BlockType = "section" | "fact" | "relationship" | "image" | "quote";

export interface ContentBlock {
  id: string;
  articleId: string;
  parentId?: string;
  blockType: BlockType;
  revealPointId: string;
  sortOrder: number;
  heading?: string;
  body?: string;
  metadata: Record<string, unknown>;
  status: ArticleStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  children?: ContentBlock[];
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
