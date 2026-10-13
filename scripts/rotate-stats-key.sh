#!/usr/bin/env bash
#
# Rotate STATS_API_KEY, the bearer key that gates GET /api/stats, and push
# the new value out to every known consumer.
#
#   scripts/rotate-stats-key.sh
#
# Generates a fresh key and writes it to three places:
#   - the hub's own .env (HUB_ENV_FILE, default: .env next to this repo)
#   - chronogrid's .env.local (CHRONOGRID_DIR, default: ~/Projects/chronogrid)
#   - Horus's secrets dir (HORUS_SECRETS_DIR, default: ~/horus/.secrets)
#
# A consumer whose directory doesn't exist on this machine is skipped with a
# note rather than failing the whole rotation - this repo is public and
# someone running it elsewhere may only have the hub checked out.
#
# The key itself is never echoed, logged or returned on stdout - only a
# clipboard copy (Wayland, via wl-copy) if one is available.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

HUB_ENV_FILE="${HUB_ENV_FILE:-$REPO_ROOT/.env}"
CHRONOGRID_DIR="${CHRONOGRID_DIR:-$HOME/Projects/chronogrid}"
HORUS_SECRETS_DIR="${HORUS_SECRETS_DIR:-$HOME/horus/.secrets}"

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'; RESET=$'\033[0m'

die()  { echo "${RED}error:${RESET} $*" >&2; exit 1; }
info() { echo "${CYAN}==>${RESET} $*"; }
ok()   { echo "${GREEN} ok${RESET} $*"; }
note() { echo "${YELLOW} skip${RESET} $*"; }

# ------------------------------------------------------------- generate
# No openssl on PATH here - 32 random bytes from the kernel, hex-encoded.
KEY="$(od -An -tx1 -N32 /dev/urandom | tr -d ' \n')"
[ "${#KEY}" -eq 64 ] || die "failed to generate a key"

# ---------------------------------------------------------------- helpers

# Replace a "VAR=..." line in $1 with VAR=$KEY, or append one if it isn't
# there yet. Preserves every other line and the file's existing permissions; a
# new file is created at 0600 rather than whatever the umask would give it.
#
# The key reaches awk through its environment, never its arguments: argv is
# readable by every local user (ps, /proc/*/cmdline), the environment isn't.
set_var_in_file() {
  local file="$1" var="$2" content

  if [ -f "$file" ]; then
    [ -w "$file" ] || die "$file is not writable"
    # Built in memory, never in a temp file: an interrupted run must not leave
    # a copy of every secret in the file lying next to it, where git doesn't
    # ignore it. If awk fails, set -e stops before the file is touched.
    content="$(VAR="$var" VALUE="$KEY" awk '
      BEGIN { line = ENVIRON["VAR"] "=" ENVIRON["VALUE"] }
      index($0, ENVIRON["VAR"] "=") == 1 { if (!done) print line; done = 1; next }
      { print }
      END { if (!done) print line }
    ' "$file")"
    # Written over the original rather than replacing it, so the file keeps
    # its inode, owner and mode. printf is a builtin: no argv to leak.
    printf '%s\n' "$content" > "$file"
  else
    mkdir -p "$(dirname "$file")"
    (
      umask 077
      printf '%s=%s\n' "$var" "$KEY" > "$file"
    )
  fi
}

# ---------------------------------------------------------------- hub .env
info "Hub .env ($HUB_ENV_FILE)"
set_var_in_file "$HUB_ENV_FILE" "STATS_API_KEY"
ok "STATS_API_KEY written"

# --------------------------------------------------------- horus secrets
info "Horus secrets ($HORUS_SECRETS_DIR)"
if [ -d "$HORUS_SECRETS_DIR" ]; then
  (
    umask 077
    printf '%s' "$KEY" > "$HORUS_SECRETS_DIR/stellar-stats"
  )
  chmod 600 "$HORUS_SECRETS_DIR/stellar-stats"
  ok "stellar-stats written"
else
  note "$HORUS_SECRETS_DIR does not exist - skipped"
fi

# ------------------------------------------------------------ chronogrid
info "chronogrid .env.local ($CHRONOGRID_DIR)"
if [ -d "$CHRONOGRID_DIR" ]; then
  set_var_in_file "$CHRONOGRID_DIR/.env.local" "STELLAR_STATS_KEY"
  ok "STELLAR_STATS_KEY written"
else
  note "$CHRONOGRID_DIR does not exist - skipped"
fi

# -------------------------------------------------------------- clipboard
if command -v wl-copy >/dev/null; then
  printf '%s' "$KEY" | wl-copy
  ok "key copied to clipboard (wl-copy) - paste it into Vercel"
else
  note "wl-copy not found - read the new key yourself from $HUB_ENV_FILE (STATS_API_KEY) if you need to paste it elsewhere"
fi

unset KEY

echo
echo "${GREEN}Rotated.${RESET} Still to do:"
echo "  - add/replace STATS_API_KEY in Vercel (Production) and redeploy the hub"
echo "  - run chronogrid-restart (it only reads .env.local at start)"
echo "  - nothing to do for Horus - it reads its file on every call"
