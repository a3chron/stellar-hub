ALTER TABLE "theme_versions" ALTER COLUMN "min_starship_version" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "theme_versions" ALTER COLUMN "min_starship_version" DROP NOT NULL;--> statement-breakpoint
-- Every stored value so far is the old form default rather than a stated
-- requirement, so clear them all instead of presenting 1.24.0 as one.
UPDATE "theme_versions" SET "min_starship_version" = NULL;
