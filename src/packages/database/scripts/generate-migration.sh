#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../apps/api/.env}"

args=(generate)
if [[ -n "${1:-}" ]]; then
  args+=(--name="$1")
fi

exec bun --env-file "$ENV_FILE" drizzle-kit "${args[@]}"
