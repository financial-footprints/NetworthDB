#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

TESTS_ONLY=false
for arg in "$@"; do
	case "$arg" in
	--tests) TESTS_ONLY=true ;;
	*)
		echo "Usage: kill.sh [--tests]" >&2
		exit 1
		;;
	esac
done

kill_port_from_env() {
	local env="$1"
	[ -f "$env" ] || return 0
	set -a
	# shellcheck source=/dev/null
	source "$env"
	set +a
	if [ -n "${PORT:-}" ]; then
		fuser -k "${PORT}/tcp" 2>/dev/null || true
	fi
	unset PORT
}

if [ "$TESTS_ONLY" = true ]; then
	for env in src/apps/*/.env.tests; do
		kill_port_from_env "$env"
	done
else
	for env in src/apps/*/.env; do
		kill_port_from_env "$env"
	done
	docker compose down
fi
