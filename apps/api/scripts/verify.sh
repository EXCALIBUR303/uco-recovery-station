#!/usr/bin/env sh
# Runs the invariant checks against the database named in .env.
# npm does not load .env for scripts, so we do it here.
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env found. Copy .env.example to .env first." >&2
  exit 1
fi

set -a
. ./.env
set +a

# postgresql@17 is keg-only, so psql may not be on PATH yet.
if ! command -v psql >/dev/null 2>&1; then
  for d in /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin; do
    [ -x "$d/psql" ] && PATH="$d:$PATH" && export PATH && break
  done
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Add it to your PATH:" >&2
  echo '  echo '"'"'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"'"'"' >> ~/.zshrc && source ~/.zshrc' >&2
  exit 1
fi

# `?schema=` is a Prisma-only parameter; libpq rejects it. Strip it out.
PSQL_URL=$(printf '%s' "$DATABASE_URL" \
  | sed -E 's/([?&])schema=[^&]*/\1/' \
  | sed -E 's/\?&/?/' \
  | sed -E 's/[?&]$//')

exec psql "$PSQL_URL" -v ON_ERROR_STOP=1 -q -f prisma/verify-invariants.sql
