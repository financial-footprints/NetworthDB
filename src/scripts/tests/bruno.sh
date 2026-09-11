#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
API_DIR="$ROOT/src/apps/api"
DATABASE_PACKAGE_DIR="$ROOT/src/packages/database"
ENV_TESTS="$API_DIR/.env.tests"
STATEMENTS_NODE="$ROOT/src/packages/statements/statements.node"
BRUNO_DIR="$API_DIR/tests/bruno"
LOG_FILE="$BRUNO_DIR/.run/api.log"
PID_FILE="$BRUNO_DIR/.run/api.pid"
KILL_SCRIPT="$ROOT/src/scripts/management/kill.sh"

mkdir -p "$BRUNO_DIR/.run"

cleanup() {
	if [ -f "$PID_FILE" ]; then
		kill "$(cat "$PID_FILE")" 2>/dev/null || true
		rm -f "$PID_FILE"
	fi
	bash "$KILL_SCRIPT" --tests
}

trap cleanup EXIT

cd "$ROOT"

docker compose up -d --wait

if [ ! -f "$STATEMENTS_NODE" ]; then
	echo "Missing $STATEMENTS_NODE — build NAPI artifacts first:" >&2
	echo "  bun run --filter @ndb/statements build:debug" >&2
	exit 1
fi

bun --cwd "$DATABASE_PACKAGE_DIR" --env-file "$ENV_TESTS" node_modules/.bin/drizzle-kit migrate
bun --cwd "$DATABASE_PACKAGE_DIR" --env-file "$ENV_TESTS" scripts/seed.ts

bash "$KILL_SCRIPT" --tests

bun --cwd "$API_DIR" --env-file "$ENV_TESTS" src/index.ts >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"

for _ in $(seq 1 30); do
	if curl -sf "http://127.0.0.1:8001/health" >/dev/null; then
		break
	fi
	sleep 0.2
done

if ! curl -sf "http://127.0.0.1:8001/health" >/dev/null; then
	echo "API did not become ready on :8001. Log:" >&2
	tail -n 20 "$LOG_FILE" >&2 || true
	exit 1
fi

if ! curl -sf -X POST "http://127.0.0.1:8001/api/v1/auth/login" \
	-H "Content-Type: application/json" \
	-d '{"username":"admin","password":"admin"}' | rg -q '"session_token"'; then
	echo "Seed/admin login preflight failed. Check Postgres users table and seed.ts output." >&2
	tail -n 30 "$LOG_FILE" >&2 || true
	exit 1
fi

bun --cwd "$BRUNO_DIR" "$ROOT/node_modules/@usebruno/cli/bin/bru.js" run --env tests --sandbox=developer
