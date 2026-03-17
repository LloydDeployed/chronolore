CREATE TABLE "passage_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passage_id" uuid NOT NULL,
	"body" text NOT NULL,
	"passage_type" "passage_type" DEFAULT 'prose' NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "published_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "passage_revisions" ADD CONSTRAINT "passage_revisions_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passage_revisions" ADD CONSTRAINT "passage_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_passage_revisions_passage" ON "passage_revisions" USING btree ("passage_id");--> statement-breakpoint
CREATE INDEX "idx_sections_parent" ON "sections" USING btree ("parent_id");