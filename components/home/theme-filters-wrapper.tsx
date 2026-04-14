import ThemeFilters from "@/components/theme-filters";
import { db } from "@/lib/db";

export async function ThemeFiltersWrapper() {
  const colorSchemes = await db.query.colorSchemes.findMany({
    orderBy: (colorSchemes, { asc }) => [asc(colorSchemes.name)],
  });

  return <ThemeFilters colorSchemes={colorSchemes} />;
}
