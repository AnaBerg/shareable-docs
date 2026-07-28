CREATE TABLE "document_share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "document_share_links" ADD CONSTRAINT "document_share_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_share_links" ADD CONSTRAINT "document_share_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_share_links_token_hash_unique" ON "document_share_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "document_share_links_document_id_idx" ON "document_share_links" USING btree ("document_id");