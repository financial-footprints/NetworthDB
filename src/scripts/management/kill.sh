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

kill_tcp_port() {
	local port="$1"
	fuser -k "${port}/tcp" 2>/dev/null || true
}

# Unset PORT= from env files (comments ignored).
read_port_from_env_file() {
	local env="$1"
	[ -f "$env" ] || return 0
	local line
	line="$(grep -E '^[[:space:]]*PORT=' "$env" | head -1 || true)"
	[ -n "$line" ] || return 0
	line="${line#PORT=}"
	line="${line#"${line%%[![:space:]]*}"}"
	line="${line%%[[:space:]]*}"
	line="${line%\"}"
	line="${line#\"}"
	line="${line%\'}"
	line="${line#\'}"
	if [ -n "$line" ]; then
		printf '%s' "$line"
	fi
}

declare -a PORTS_TO_KILL=()

add_port() {
	local port="$1"
	[ -n "$port" ] || return 0
	local existing
	for existing in "${PORTS_TO_KILL[@]:-}"; do
		if [ "$existing" = "$port" ]; then
			return 0
		fi
	done
	PORTS_TO_KILL+=("$port")
}

resolve_app_port() {
	local env="$1"
	local default_port="$2"
	local port
	port="$(read_port_from_env_file "$env")"
	if [ -z "$port" ]; then
		port="$(read_port_from_env_file "${env}.example")"
	fi
	if [ -z "$port" ]; then
		port="$default_port"
	fi
	add_port "$port"
}

if [ "$TESTS_ONLY" = true ]; then
	resolve_app_port "src/apps/api/.env.tests" 8001
else
	resolve_app_port "src/apps/api/.env" 8000
	resolve_app_port "src/apps/web/.env" 3000
	resolve_app_port "src/apps/copilot/.env" 8002
	docker compose down
fi

for port in "${PORTS_TO_KILL[@]}"; do
	kill_tcp_port "$port"
done
