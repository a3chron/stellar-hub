import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000",
  // Teaches the client about the extra user columns declared server-side
  // (`username`, `bio`), so the sign-up form can send a handle and the session
  // user is typed with it. The import above is type-only and erased at build,
  // so no server code is pulled into the bundle.
  plugins: [inferAdditionalFields<typeof auth>()],
});
