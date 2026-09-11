#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "${1:-$PWD}" && pwd)"

export PATH="${HOME}/.cargo/bin:${PATH}"

if ! command -v cargo-watch >/dev/null; then
	echo "Installing cargo-watch..." >&2
	cargo +stable install cargo-watch --locked
fi

cd "$PACKAGE_DIR"

exec cargo watch \
	--postpone \
	-w src \
	-w Cargo.toml \
	-s "bun run build:debug"
