ALTER TABLE "infoboxes" ADD COLUMN "status" "article_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "infoboxes" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "infoboxes" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "infoboxes" ADD CONSTRAINT "infoboxes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;