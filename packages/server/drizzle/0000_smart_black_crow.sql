CREATE TYPE "public"."article_status" AS ENUM('draft', 'review', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('book', 'movie', 'season', 'game', 'other');--> statement-breakpoint
CREATE TYPE "public"."infobox_field_mode" AS ENUM('replace', 'append');--> statement-breakpoint
CREATE TYPE "public"."passage_type" AS ENUM('prose', 'quote', 'note');--> statement-breakpoint
CREATE TYPE "public"."segment_type" AS ENUM('part', 'chapter', 'episode', 'act', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('contributor', 'moderator', 'admin');--> statement-breakpoint
CREATE TABLE "article_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"linked_article_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"reveal_point_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "article_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" uuid NOT NULL,
	"article_type_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"introduced_at" uuid,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cross_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_passage_id" uuid NOT NULL,
	"target_article_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dynamic_table_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"reveal_point_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dynamic_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid,
	"heading" text,
	"columns" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" uuid NOT NULL,
	"series_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"entry_type" "entry_type" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "external_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"source_type" text NOT NULL,
	"url" text,
	"date" text,
	"reveal_point_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "infobox_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"infobox_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"field_label" text NOT NULL,
	"field_value" text NOT NULL,
	"mode" "infobox_field_mode" DEFAULT 'replace' NOT NULL,
	"reveal_point_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "infoboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "infoboxes_article_id_unique" UNIQUE("article_id")
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"body" text NOT NULL,
	"reveal_point_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"passage_type" "passage_type" DEFAULT 'prose' NOT NULL,
	"rejection_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reveal_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"segment_id" uuid
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"heading" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"segment_type" "segment_type" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "universe_roles" (
	"user_id" uuid NOT NULL,
	"universe_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	CONSTRAINT "universe_roles_user_id_universe_id_pk" PRIMARY KEY("user_id","universe_id")
);
--> statement-breakpoint
CREATE TABLE "universes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "universes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"user_id" uuid NOT NULL,
	"reveal_point_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_progress_user_id_reveal_point_id_pk" PRIMARY KEY("user_id","reveal_point_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'contributor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "article_identities" ADD CONSTRAINT "article_identities_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_identities" ADD CONSTRAINT "article_identities_linked_article_id_articles_id_fk" FOREIGN KEY ("linked_article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_identities" ADD CONSTRAINT "article_identities_reveal_point_id_reveal_points_id_fk" FOREIGN KEY ("reveal_point_id") REFERENCES "public"."reveal_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_types" ADD CONSTRAINT "article_types_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_article_type_id_article_types_id_fk" FOREIGN KEY ("article_type_id") REFERENCES "public"."article_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_introduced_at_reveal_points_id_fk" FOREIGN KEY ("introduced_at") REFERENCES "public"."reveal_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_source_passage_id_passages_id_fk" FOREIGN KEY ("source_passage_id") REFERENCES "public"."passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_target_article_id_articles_id_fk" FOREIGN KEY ("target_article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_table_rows" ADD CONSTRAINT "dynamic_table_rows_table_id_dynamic_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dynamic_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_table_rows" ADD CONSTRAINT "dynamic_table_rows_reveal_point_id_reveal_points_id_fk" FOREIGN KEY ("reveal_point_id") REFERENCES "public"."reveal_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_table_rows" ADD CONSTRAINT "dynamic_table_rows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_tables" ADD CONSTRAINT "dynamic_tables_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_sources" ADD CONSTRAINT "external_sources_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_sources" ADD CONSTRAINT "external_sources_reveal_point_id_reveal_points_id_fk" FOREIGN KEY ("reveal_point_id") REFERENCES "public"."reveal_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infobox_fields" ADD CONSTRAINT "infobox_fields_infobox_id_infoboxes_id_fk" FOREIGN KEY ("infobox_id") REFERENCES "public"."infoboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infobox_fields" ADD CONSTRAINT "infobox_fields_reveal_point_id_reveal_points_id_fk" FOREIGN KEY ("reveal_point_id") REFERENCES "public"."reveal_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infobox_fields" ADD CONSTRAINT "infobox_fields_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infoboxes" ADD CONSTRAINT "infoboxes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_reveal_point_id_reveal_points_id_fk" FOREIGN KEY ("reveal_point_id") REFERENCES "public"."reveal_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reveal_points" ADD CONSTRAINT "reveal_points_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reveal_points" ADD CONSTRAINT "reveal_points_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reveal_points" ADD CONSTRAINT "reveal_points_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_roles" ADD CONSTRAINT "universe_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_roles" ADD CONSTRAINT "universe_roles_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_reveal_point_id_reveal_points_id_fk" FOREIGN KEY ("reveal_point_id") REFERENCES "public"."reveal_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_article_identities_article" ON "article_identities" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_article_identities_linked" ON "article_identities" USING btree ("linked_article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "article_types_universe_slug" ON "article_types" USING btree ("universe_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_universe_slug" ON "articles" USING btree ("universe_id","slug");--> statement-breakpoint
CREATE INDEX "idx_dynamic_table_rows_table" ON "dynamic_table_rows" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "idx_dynamic_table_rows_reveal" ON "dynamic_table_rows" USING btree ("reveal_point_id");--> statement-breakpoint
CREATE INDEX "idx_dynamic_tables_section" ON "dynamic_tables" USING btree ("section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_universe_slug" ON "entries" USING btree ("universe_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "external_sources_universe_slug" ON "external_sources" USING btree ("universe_id","slug");--> statement-breakpoint
CREATE INDEX "idx_infobox_fields_infobox" ON "infobox_fields" USING btree ("infobox_id");--> statement-breakpoint
CREATE INDEX "idx_infobox_fields_reveal" ON "infobox_fields" USING btree ("reveal_point_id");--> statement-breakpoint
CREATE INDEX "idx_passages_section" ON "passages" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_passages_reveal" ON "passages" USING btree ("reveal_point_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reveal_points_entry_segment" ON "reveal_points" USING btree ("entry_id","segment_id");--> statement-breakpoint
CREATE INDEX "idx_sections_article" ON "sections" USING btree ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "segments_entry_slug" ON "segments" USING btree ("entry_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "series_universe_slug" ON "series" USING btree ("universe_id","slug");