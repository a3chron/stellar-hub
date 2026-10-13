import type { InferSelectModel } from "drizzle-orm";
import type {
  cliAuthRequests,
  cliInstalls,
  cliTokens,
  colorSchemes,
  themeDrafts,
  themes,
  themeVersions,
  user,
} from "./schema";

export type Theme = InferSelectModel<typeof themes>;
export type ThemeVersion = InferSelectModel<typeof themeVersions>;
export type User = InferSelectModel<typeof user>;
export type CliInstall = InferSelectModel<typeof cliInstalls>;
export type CliAuthRequest = InferSelectModel<typeof cliAuthRequests>;
export type CliToken = InferSelectModel<typeof cliTokens>;
export type ThemeDraft = InferSelectModel<typeof themeDrafts>;
export type ColorScheme = InferSelectModel<typeof colorSchemes>;
