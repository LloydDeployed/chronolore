-- Migration: Add passage_containers table and container columns to passages
-- Enables grouping passages as continuous prose blocks or table layouts within sections.

-- 1. Create passage_containers table
CREATE TABLE IF NOT EXISTS "passage_containers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "section_id" uuid NOT NULL REFERENCES "sections"("id") ON DELETE CASCADE,
  "type" text NOT NULL CHECK ("type" IN ('paragraph', 'table')),
  "title" text,
  "config" jsonb DEFAULT '{}',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_passage_containers_section" ON "passage_containers" ("section_id");

-- 2. Add container columns to passages
ALTER TABLE "passages" ADD COLUMN IF NOT EXISTS "container_id" uuid REFERENCES "passage_containers"("id") ON DELETE SET NULL;
ALTER TABLE "passages" ADD COLUMN IF NOT EXISTS "container_meta" jsonb DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "idx_passages_container" ON "passages" ("container_id");
