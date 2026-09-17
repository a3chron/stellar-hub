CREATE TABLE "cli_installs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"os" text,
	"arch" text,
	"first_version" text NOT NULL,
	"version" text NOT NULL,
	"updates" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"uninstalled_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "idx_cli_installs_version" ON "cli_installs" USING btree ("version");--> statement-breakpoint
CREATE INDEX "idx_cli_installs_uninstalled_at" ON "cli_installs" USING btree ("uninstalled_at");