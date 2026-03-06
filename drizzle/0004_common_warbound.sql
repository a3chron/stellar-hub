CREATE TYPE "public"."color_mode" AS ENUM('dark', 'light', 'both');--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "color_mode" "color_mode" DEFAULT 'dark' NOT NULL;