import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  bio: text("bio"),
  socialLinks: jsonb("social_links").$type<{
    github?: string;
    website?: string;
  }>(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

// Color Schemes (global reference list)
export const colorSchemes = pgTable("color_schemes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Themes
export const themes = pgTable(
  "themes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    screenshotUrl: text("screenshot_url").notNull(),
    downloads: integer("downloads").default(0).notNull(),
    group: text("group"),
    colorSchemeId: uuid("color_scheme_id").references(() => colorSchemes.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueAuthorSlug: uniqueIndex("unique_author_slug").on(
      table.authorId,
      table.slug,
    ),
    downloadsIdx: index("idx_themes_downloads").on(table.downloads),
    authorIdx: index("idx_themes_author").on(table.authorId),
    createdAtIdx: index("idx_themes_created_at").on(table.createdAt),
  }),
);

// Theme Versions
export const themeVersions = pgTable(
  "theme_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    themeId: uuid("theme_id")
      .references(() => themes.id, { onDelete: "cascade" })
      .notNull(),
    version: text("version").notNull(),
    configContent: text("config_content").notNull(),
    versionNotes: text("version_notes"),
    dependencies: text("dependencies").array(),
    minStarshipVersion: text("min_starship_version")
      .notNull()
      .default("1.24.0"),
    installationNotes: text("installation_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueThemeVersion: uniqueIndex("unique_theme_version").on(
      table.themeId,
      table.version,
    ),
  }),
);

// Relations
export const userRelations = relations(user, ({ many }) => ({
  themes: many(themes),
}));

export const themesRelations = relations(themes, ({ one, many }) => ({
  author: one(user, {
    fields: [themes.authorId],
    references: [user.id],
  }),
  versions: many(themeVersions),
  colorScheme: one(colorSchemes, {
    fields: [themes.colorSchemeId],
    references: [colorSchemes.id],
  }),
}));

export const themeVersionsRelations = relations(themeVersions, ({ one }) => ({
  theme: one(themes, {
    fields: [themeVersions.themeId],
    references: [themes.id],
  }),
}));
