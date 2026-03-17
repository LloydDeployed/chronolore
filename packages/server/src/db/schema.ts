/**
 * Chronolore v2 Schema
 *
 * Key changes from v1:
 * - content_blocks table REMOVED (replaced by sections + passages)
 * - articles.introduced_at is now NULLABLE (null = evergreen, always visible)
 * - New tables: sections, passages, infoboxes, infobox_fields
 * - Post-MVP tables (created but unused): article_identities, dynamic_tables, dynamic_table_rows
 * - New enums: passage_type, infobox_field_mode
 *
 * Design decisions:
 * - Nullable reveal_point_id = evergreen content (always visible regardless of reader progress)
 * - No superseded_at in MVP — for infobox replace-mode fields, latest revealed value wins
 * - passage_type is extensible: prose, quote, note for now
 * - UUIDs for all PKs (matching existing convention)
 * - crossReferences and externalSources kept from v1 but crossReferences will need
 *   updating post-migration since it referenced content_blocks
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// ── Enums (existing) ──

export const entryTypeEnum = pgEnum("entry_type", [
  "book",
  "movie",
  "season",
  "game",
  "other",
]);

export const segmentTypeEnum = pgEnum("segment_type", [
  "part",
  "chapter",
  "episode",
  "act",
  "other",
]);

export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "review",
  "published",
  "rejected",
]);

export const userRoleEnum = pgEnum("user_role", [
  "contributor",
  "moderator",
  "admin",
]);

// ── Enums (new in v2) ──

/** Type of passage content. Extensible later. */
export const passageTypeEnum = pgEnum("passage_type", [
  "prose",
  "quote",
  "note",
]);

/** How an infobox field behaves when multiple values exist at different reveal points. */
export const infoboxFieldModeEnum = pgEnum("infobox_field_mode", [
  "replace", // latest revealed value wins
  "append",  // all revealed values shown as a list
]);

// ── Users ──

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").unique().notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("contributor"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const universeRoles = pgTable(
  "universe_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    universeId: uuid("universe_id")
      .notNull()
      .references(() => universes.id),
    role: userRoleEnum("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.universeId] })],
);

export const userProgress = pgTable(
  "user_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    revealPointId: uuid("reveal_point_id")
      .notNull()
      .references(() => revealPoints.id),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.revealPointId] })],
);

// ── Media Hierarchy (unchanged) ──

export const universes = pgTable("universes", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const series = pgTable(
  "series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    universeId: uuid("universe_id")
      .notNull()
      .references(() => universes.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("series_universe_slug").on(t.universeId, t.slug)],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    universeId: uuid("universe_id")
      .notNull()
      .references(() => universes.id),
    seriesId: uuid("series_id").references(() => series.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    entryType: entryTypeEnum("entry_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("entries_universe_slug").on(t.universeId, t.slug)],
);

export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    segmentType: segmentTypeEnum("segment_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("segments_entry_slug").on(t.entryId, t.slug)],
);

// ── Reveal Points (unchanged) ──

export const revealPoints = pgTable(
  "reveal_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    universeId: uuid("universe_id")
      .notNull()
      .references(() => universes.id),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id),
    segmentId: uuid("segment_id").references(() => segments.id),
  },
  (t) => [uniqueIndex("reveal_points_entry_segment").on(t.entryId, t.segmentId)],
);

// ── Article Types (unchanged) ──

export const articleTypes = pgTable(
  "article_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    universeId: uuid("universe_id").references(() => universes.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    icon: text("icon"),
  },
  (t) => [uniqueIndex("article_types_universe_slug").on(t.universeId, t.slug)],
);

// ── Articles (v2: introduced_at is now NULLABLE) ──

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    universeId: uuid("universe_id")
      .notNull()
      .references(() => universes.id),
    articleTypeId: uuid("article_type_id")
      .notNull()
      .references(() => articleTypes.id),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /**
     * v2 change: NULLABLE. Null means evergreen — article is always visible
     * regardless of reader progress. Non-null means the article only appears
     * once the reader has reached this reveal point.
     */
    introducedAt: uuid("introduced_at").references(() => revealPoints.id),
    status: articleStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("articles_universe_slug").on(t.universeId, t.slug)],
);

// ── Sections (new in v2) ──
// Named grouping within an article. No reveal point — a section is visible
// if any of its child passages are visible to the reader.

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    /** Null = top-level section. Non-null = subsection of parent. Max depth 3 (H2→H3→H4). */
    parentId: uuid("parent_id"),
    heading: text("heading").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_sections_article").on(t.articleId),
    index("idx_sections_parent").on(t.parentId),
  ],
);

// ── Passages (new in v2) ──
// The atomic unit of revealable content. Each passage is independently gated
// by a reveal point. Null reveal_point_id = evergreen (always visible).

export const passages = pgTable(
  "passages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /**
     * Null = evergreen passage, always visible.
     * Non-null = only visible when reader has reached this reveal point.
     */
    revealPointId: uuid("reveal_point_id").references(() => revealPoints.id),
    sortOrder: integer("sort_order").notNull().default(0),
    status: articleStatusEnum("status").notNull().default("draft"),
    passageType: passageTypeEnum("passage_type").notNull().default("prose"),
    rejectionReason: text("rejection_reason"),
    /** Points to the currently published revision (null if never published) */
    publishedRevisionId: uuid("published_revision_id"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_passages_section").on(t.sectionId),
    index("idx_passages_reveal").on(t.revealPointId),
  ],
);

// ── Passage Revisions (v2.1) ──
// Full revision history for passages. When a published passage is edited,
// a new draft revision is created while the published revision remains intact.

export const passageRevisions = pgTable(
  "passage_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    passageId: uuid("passage_id")
      .notNull()
      .references(() => passages.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    passageType: passageTypeEnum("passage_type").notNull().default("prose"),
    status: articleStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_passage_revisions_passage").on(t.passageId),
  ],
);

// ── Infoboxes (new in v2) ──
// Structured data panel (biography card, quick facts). One per article, optional.

export const infoboxes = pgTable("infoboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .unique()
    .references(() => articles.id, { onDelete: "cascade" }),
  imageUrl: text("image_url"),
  status: articleStatusEnum("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Infobox Fields (new in v2) ──
// Individual key/value pairs, independently reveal-gated.
// mode='replace': latest revealed value wins at a given reader progress.
// mode='append': all revealed values are shown as a list.

export const infoboxFields = pgTable(
  "infobox_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    infoboxId: uuid("infobox_id")
      .notNull()
      .references(() => infoboxes.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    fieldLabel: text("field_label").notNull(),
    fieldValue: text("field_value").notNull(),
    mode: infoboxFieldModeEnum("mode").notNull().default("replace"),
    /**
     * Null = evergreen field, always visible.
     * Non-null = only visible when reader has reached this reveal point.
     */
    revealPointId: uuid("reveal_point_id").references(() => revealPoints.id),
    sortOrder: integer("sort_order").notNull().default(0),
    status: articleStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_infobox_fields_infobox").on(t.infoboxId),
    index("idx_infobox_fields_reveal").on(t.revealPointId),
  ],
);

// ── Article Identities (post-MVP, schema only) ──
// For secret identities, possessed characters, etc.
// e.g. OreSeur → TenSoon (replaced_by), Kelsier → Survivor (alias_of)

export const articleIdentities = pgTable(
  "article_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    linkedArticleId: uuid("linked_article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type").notNull(),
    revealPointId: uuid("reveal_point_id").references(() => revealPoints.id),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_article_identities_article").on(t.articleId),
    index("idx_article_identities_linked").on(t.linkedArticleId),
  ],
);

// ── Dynamic Tables (post-MVP, schema only) ──
// For structured tabular data where rows reveal independently.
// e.g. "Known Allomantic Metals" table.

export const dynamicTables = pgTable(
  "dynamic_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id").references(() => sections.id, {
      onDelete: "cascade",
    }),
    heading: text("heading"),
    columns: jsonb("columns").notNull(), // [{key, label, width?}]
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_dynamic_tables_section").on(t.sectionId)],
);

export const dynamicTableRows = pgTable(
  "dynamic_table_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => dynamicTables.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull(), // {metal: "Iron", ability: "Pulls metals"}
    revealPointId: uuid("reveal_point_id").references(() => revealPoints.id),
    sortOrder: integer("sort_order").notNull().default(0),
    status: articleStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_dynamic_table_rows_table").on(t.tableId),
    index("idx_dynamic_table_rows_reveal").on(t.revealPointId),
  ],
);

// ── External Sources (unchanged) ──

export const externalSources = pgTable(
  "external_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    universeId: uuid("universe_id")
      .notNull()
      .references(() => universes.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    sourceType: text("source_type").notNull(),
    url: text("url"),
    date: text("date"),
    revealPointId: uuid("reveal_point_id")
      .notNull()
      .references(() => revealPoints.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("external_sources_universe_slug").on(t.universeId, t.slug)],
);

// ── Cross-References ──
// NOTE: v1 referenced content_blocks. This will need migration to reference
// passages instead. Keeping the table structure for now.

export const crossReferences = pgTable("cross_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourcePassageId: uuid("source_passage_id")
    .notNull()
    .references(() => passages.id, { onDelete: "cascade" }),
  targetArticleId: uuid("target_article_id")
    .notNull()
    .references(() => articles.id),
});
