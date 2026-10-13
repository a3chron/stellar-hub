import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// One client per process. `next dev` re-runs this module on every hot reload,
// and each run used to open a fresh pool while the old one kept its
// connections - an evening of edits exhausted the database's connection
// limit. globalThis survives the reloads; in production the module only runs
// once per instance anyway.
const cached = globalThis as typeof globalThis & {
  stellarDbClient?: ReturnType<typeof postgres>;
};

if (!cached.stellarDbClient) {
  // Disable prefetch for Supabase pooler compatibility
  cached.stellarDbClient = postgres(connectionString, { prepare: false });
}

export const db = drizzle(cached.stellarDbClient, { schema });
