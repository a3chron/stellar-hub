-- The highest version number ever deleted from a theme. New versions have to
-- be newer than it too, so a deleted number never comes back with a different
-- config. IF NOT EXISTS so it can also be run by hand (Supabase SQL editor)
-- before `db:migrate` records it, without the migrate failing afterwards.
ALTER TABLE "themes" ADD COLUMN IF NOT EXISTS "highest_deleted_version" text;
