-- Adds `username`, the public author handle, and backfills it for the accounts
-- that predate it.
--
-- Every existing account signed in with GitHub, where `name` was mapped from
-- the GitHub login (lib/auth.ts), so `name` is already a valid handle and is
-- copied over verbatim. That is what keeps existing `/<author>` URLs and
-- `stellar apply <author>/<theme>` resolving after this migration. The steps
-- after it are defensive: they only touch rows the straight copy could not
-- handle.
--
-- Deploy ordering: the column carries a DB-level default (set at the end), so
-- the currently deployed code - which knows nothing about `username` and so
-- inserts without it - keeps being able to create users during the window
-- between running this migration and shipping the new build. Without that
-- default, every signup in that window would fail the NOT NULL constraint.

-- Nullable first - the table has rows, so a NOT NULL column with no default
-- cannot be added in a single statement.
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint

-- The straight copy, for names that already satisfy the handle rules
-- (see lib/username.ts - same shape, and a subset of the charset the CLI's
-- identifier parser accepts).
UPDATE "user" SET "username" = "name"
WHERE "name" ~ '^[a-zA-Z0-9]([a-zA-Z0-9_-]{0,37}[a-zA-Z0-9])?$';--> statement-breakpoint

-- Anything left over gets slugified into that charset.
UPDATE "user"
SET "username" = NULLIF(
  regexp_replace(
    regexp_replace(
      regexp_replace(lower("name"), '[^a-z0-9_-]+', '-', 'g'),
      '-{2,}', '-', 'g'
    ),
    '^[-_]+|[-_]+$', '', 'g'
  ),
  ''
)
WHERE "username" IS NULL;--> statement-breakpoint

-- Last resort, for a name that slugifies to nothing at all (e.g. entirely
-- non-latin). Derived from the id so it is stable if this is ever re-run.
UPDATE "user" SET "username" = 'user-' || substr(md5("id"), 1, 8)
WHERE "username" IS NULL;--> statement-breakpoint

-- Enforce the 39 character limit, trimming any separator the cut exposed.
UPDATE "user" SET "username" = regexp_replace(left("username", 39), '[-_]+$', '')
WHERE length("username") > 39;--> statement-breakpoint

-- Resolve the two cases the unique index below would reject or the router
-- would swallow: handles that collide case-insensitively, and handles that
-- match a real top-level route (`/settings`, `/api`, ...) and would therefore
-- be shadowed by it, unreachable and - because lib/username.ts refuses
-- reserved names - unfixable by the user themselves.
--
-- Suffixes are searched against live table state rather than computed in one
-- pass, because a single pass can manufacture a fresh collision: with `bob`,
-- `Bob` and `bob-2` present, rewriting `Bob` to `bob-2` would collide with the
-- row that was already there and abort the migration.
--
-- The reserved list mirrors RESERVED_USERNAMES in lib/username.ts as of this
-- migration. It is a point-in-time copy on purpose: a migration has to keep
-- doing what it did when it ran, so it must not follow later edits there.
DO $$
DECLARE
  target RECORD;
  candidate text;
  suffix int;
  reserved text[] := ARRAY[
    '_next','about','account','admin','api','assets','auth','blog','cli',
    'contact','dashboard','doc','docs','download','downloads','edit','explore',
    'favicon','feed','forgot-password','help','home','hub','index','legal',
    'login','logout','me','new','null','privacy','profile','public','register',
    'reset-password','robots','root','search','settings','signin','sign-in',
    'signout','sign-out','signup','sign-up','sitemap','static','stellar',
    'support','terms','theme','themes','undefined','upload','user','users',
    'verify-email','welcome'
  ];
BEGIN
  FOR target IN
    SELECT u."id", u."username"
    FROM "user" u
    WHERE lower(u."username") = ANY(reserved)
       OR EXISTS (
         SELECT 1 FROM "user" older
         WHERE lower(older."username") = lower(u."username")
           AND older."id" <> u."id"
           AND (
             older."createdAt" < u."createdAt"
             OR (older."createdAt" = u."createdAt" AND older."id" < u."id")
           )
       )
    ORDER BY u."createdAt", u."id"
  LOOP
    suffix := 1;
    LOOP
      suffix := suffix + 1;
      candidate := regexp_replace(
        left(target."username", 38 - length(suffix::text)), '[-_]+$', ''
      ) || '-' || suffix;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "user" WHERE lower("username") = lower(candidate)
      );
    END LOOP;
    UPDATE "user" SET "username" = candidate WHERE "id" = target."id";
  END LOOP;
END $$;--> statement-breakpoint

ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint

-- Safety net for inserts that supply no handle. The app always supplies one
-- (lib/auth.ts fills it for every provider before the row is written), so this
-- should never be what lands - but it is what makes the migration safe to run
-- ahead of the deploy, and it keeps a future code path that forgets the column
-- from taking user creation down.
ALTER TABLE "user" ALTER COLUMN "username"
  SET DEFAULT ('user-' || substr(md5(random()::text), 1, 12));--> statement-breakpoint

CREATE UNIQUE INDEX "unique_username_lower" ON "user" USING btree (lower("username"));
