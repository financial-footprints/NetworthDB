#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../apps/api/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

export PGPASSWORD="${POSTGRES_PASSWORD:-}"

PSQL_ARGS=(
  -v ON_ERROR_STOP=1
  -h "${POSTGRES_HOST:-localhost}"
  -p "${POSTGRES_PORT:-5432}"
  -U "${POSTGRES_USER:-networthdb}"
  -d "${POSTGRES_DATABASE:-networthdb}"
)

psql "${PSQL_ARGS[@]}" -f "$ROOT_DIR/drizzle/seed/seed.sql"

if [[ "${ENVIRONMENT:-}" == "local" ]]; then
  bun "$ROOT_DIR/scripts/render-local-seed.ts" | psql "${PSQL_ARGS[@]}"
fi
