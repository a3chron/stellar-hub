ALTER TABLE "theme_versions" DROP COLUMN dependencies;

ALTER TABLE "theme_versions" ADD COLUMN "dependencies"  text[];