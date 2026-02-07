import type { InferSelectModel } from "drizzle-orm";
import type { themes, themeVersions, user } from "./schema";

export type Theme = InferSelectModel<typeof themes>;
export type ThemeVersion = InferSelectModel<typeof themeVersions>;
export type User = InferSelectModel<typeof user>;
