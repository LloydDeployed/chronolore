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

// ── Enums ──

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

export const blockTypeEnum = pgEnum("block_type", [
  "section",
  "fact",
  "relationship",
  "image",
  "quote",
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

// ── Media Hierarchy ──

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

// ── Reveal Points ──

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

// ── Articles ──

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
    introducedAt: uuid("introduced_at")
      .notNull()
      .references(() => revealPoints.id),
    status: articleStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("articles_universe_slug").on(t.universeId, t.slug)],
);

export const contentBlocks = pgTable(
  "content_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id),
    parentId: uuid("parent_id"),
    blockType: blockTypeEnum("block_type").notNull(),
    revealPointId: uuid("reveal_point_id")
      .notNull()
      .references(() => revealPoints.id),
    sortOrder: integer("sort_order").notNull().default(0),
    heading: text("heading"),
    body: text("body"),
    metadata: jsonb("metadata").default({}),
    status: articleStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_blocks_article_reveal").on(t.articleId, t.revealPointId)],
);

// ── Cross-References ──

export const crossReferences = pgTable("cross_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceBlockId: uuid("source_block_id")
    .notNull()
    .references(() => contentBlocks.id),
  targetArticleId: uuid("target_article_id")
    .notNull()
    .references(() => articles.id),
});

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

// ── External Sources ──

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
