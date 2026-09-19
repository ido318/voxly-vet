#!/usr/bin/env bash
# Loads local Supabase env vars before running the given command.
# Strips quotes that `supabase status -o env` adds around values.
# Usage:
#   bash scripts/with-supabase-env.sh node scripts/seed-dev-user.mjs

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI not found in PATH." >&2
  echo "Install it, then retry. Examples:" >&2
  echo "  npm i -g supabase" >&2
  echo "  brew install supabase/tap/supabase" >&2
  echo "  See https://supabase.com/docs/guides/local-development/cli/getting-started" >&2
  echo "Cloud Agent / CI images should install the CLI in the environment install script" >&2
  echo "(.cursor/install.sh or equivalent) so integration tests can run." >&2
  exit 1
fi

# Grab the env block, strip the noisy `Stopped services` line and surrounding
# double quotes around values, then source it into this shell.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if ! (cd "$REPO_ROOT" && supabase status -o env 2>/dev/null) \
  | grep -E '^[A-Z_]+=' \
  | sed -E 's/^([A-Z_]+)="?(.*)"$/\1=\2/' \
  > "$TMP"; then
  echo "Error: failed to read local Supabase env from '$REPO_ROOT'." >&2
  echo "Is Supabase running? Try: supabase start" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -o allexport
. "$TMP"
set +o allexport

# Map Supabase status names → names our scripts expect.
export SUPABASE_URL="${API_URL:-${SUPABASE_URL:-http://127.0.0.1:54321}}"
export NEXT_PUBLIC_SUPABASE_URL="${API_URL:-${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Error: SERVICE_ROLE_KEY not found in 'supabase status -o env' output." >&2
  echo "Is Supabase running? Try: supabase start" >&2
  exit 1
fi

echo "✓ SUPABASE_URL=$SUPABASE_URL"
echo "✓ NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL"
echo "✓ NEXT_PUBLIC_SUPABASE_ANON_KEY length=${#NEXT_PUBLIC_SUPABASE_ANON_KEY}"
echo "✓ SUPABASE_SERVICE_ROLE_KEY length=${#SUPABASE_SERVICE_ROLE_KEY}"

exec "$@"
