-- CLI device login, CLI tokens and theme drafts (stellar auth / stellar publish
-- and the upload wizard).
--
-- Purely additive: three new tables, their indexes, foreign keys from them
-- to existing tables, and row level security on the new tables. Nothing
-- existing is altered, so this can run ahead of the deploy, and the previous
-- build keeps working with these tables present (it never reads them). Every
-- user/theme reference cascades, so the existing account and theme deletion
-- paths keep working untouched.
--
-- ROLLBACK
--   A code-only rollback does NOT need any of this: the old code ignores
--   these tables. To fully undo the migration:
--
--     DROP TABLE IF EXISTS theme_drafts, cli_tokens, cli_auth_requests;
--
--   No types were created (status-like columns are plain text, colorMode
--   reuses the existing "color_mode" enum). Only if the migration should be
--   re-applied later, also delete its row:
--
--     DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1791841190088;
--
--   Draft screenshots already uploaded to the `stellar` bucket are left behind
--   as orphans and need a manual cleanup.

-- One row per `stellar auth` run, until the CLI collects its token. Only the
-- SHA-256 of the device code is stored.
CREATE TABLE "cli_auth_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_code_hash" text NOT NULL,
	"user_code" text NOT NULL,
	"client" text NOT NULL,
	"ip_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" text,
	"last_polled_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cli_auth_requests_device_code_hash_unique" UNIQUE("device_code_hash"),
	CONSTRAINT "cli_auth_requests_user_code_unique" UNIQUE("user_code")
);
--> statement-breakpoint

-- Bearer tokens for the CLI, stored as SHA-256 only. Revoked by deleting the row.
CREATE TABLE "cli_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "cli_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint

-- Unpublished new themes ("theme") and new versions ("version"). Publishing
-- deletes the row in the same transaction that writes the theme/version.
CREATE TABLE "theme_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"theme_id" uuid,
	"name" text,
	"slug" text,
	"description" text,
	"group" text,
	"color_mode" "color_mode",
	"color_scheme_id" uuid,
	"version" text,
	"version_notes" text,
	"dependencies" text[] DEFAULT '{}'::text[] NOT NULL,
	"min_starship_version" text,
	"config" text,
	"config_source" text,
	"config_updated_at" timestamp with time zone,
	"screenshot_path" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "theme_drafts_code_unique" UNIQUE("code")
);
--> statement-breakpoint

-- Foreign keys live on the new tables only.
ALTER TABLE "cli_auth_requests" ADD CONSTRAINT "cli_auth_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_tokens" ADD CONSTRAINT "cli_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_drafts" ADD CONSTRAINT "theme_drafts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_drafts" ADD CONSTRAINT "theme_drafts_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_drafts" ADD CONSTRAINT "theme_drafts_color_scheme_id_color_schemes_id_fk" FOREIGN KEY ("color_scheme_id") REFERENCES "public"."color_schemes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "idx_cli_auth_requests_ip_hash" ON "cli_auth_requests" USING btree ("ip_hash");--> statement-breakpoint
CREATE INDEX "idx_cli_auth_requests_expires_at" ON "cli_auth_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_cli_tokens_user" ON "cli_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_theme_drafts_user" ON "theme_drafts" USING btree ("user_id");--> statement-breakpoint

-- Partial, so a new-theme draft and a version draft never block each other:
-- one draft per slug for new themes, one open version draft per theme.
CREATE UNIQUE INDEX "unique_draft_user_slug" ON "theme_drafts" USING btree ("user_id","slug") WHERE kind = 'theme';--> statement-breakpoint
CREATE UNIQUE INDEX "unique_draft_user_theme" ON "theme_drafts" USING btree ("user_id","theme_id") WHERE kind = 'version';--> statement-breakpoint

-- Row level security with no policies: the app connects as the table owner and
-- bypasses it. This only makes sure Supabase's Data API roles (anon /
-- authenticated) can never read login codes, token hashes or private drafts,
-- even if a grant is ever added to these tables by mistake.
ALTER TABLE "cli_auth_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cli_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "theme_drafts" ENABLE ROW LEVEL SECURITY;
