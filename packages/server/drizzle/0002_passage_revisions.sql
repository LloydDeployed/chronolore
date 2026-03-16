-- Migration: Add passage_revisions table and published_revision_id to passages
-- This enables editing published passages without removing them from the live article.

-- 1. Create passage_revisions table
CREATE TABLE IF NOT EXISTS "passage_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "passage_id" uuid NOT NULL REFERENCES "passages"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "passage_type" "passage_type" NOT NULL DEFAULT 'prose',
  "status" "article_status" NOT NULL DEFAULT 'draft',
  "rejection_reason" text,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now(),
  "published_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_passage_revisions_passage" ON "passage_revisions" ("passage_id");

-- 2. Add published_revision_id column to passages
ALTER TABLE "passages" ADD COLUMN IF NOT EXISTS "published_revision_id" uuid;

-- 3. Migrate existing data: create a revision row for each existing passage
INSERT INTO "passage_revisions" ("passage_id", "body", "passage_type", "status", "created_by", "created_at", "published_at")
SELECT
  "id",
  "body",
  "passage_type",
  "status",
  "created_by",
  "created_at",
  CASE WHEN "status" = 'published' THEN now() ELSE NULL END
FROM "passages";

-- 4. Set published_revision_id for published passages
UPDATE "passages" p
SET "published_revision_id" = pr."id"
FROM "passage_revisions" pr
WHERE pr."passage_id" = p."id"
  AND p."status" = 'published'
  AND pr."status" = 'published';
