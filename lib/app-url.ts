// The canonical public origin, for every absolute URL the API hands out
// (device login links, draft links, published theme links). The CLI only
// opens or prints URLs the server gave it, so this is the single place that
// decides where they point.
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://stellar.a3chron.dev"
).replace(/\/+$/, "");
