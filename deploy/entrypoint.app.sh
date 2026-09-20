#!/bin/sh
set -eu

FILESTORE_PATH="${FILESTORE_PATH:-/var/lib/networthdb}"
mkdir -p "$FILESTORE_PATH"
chown -R bun:bun "$FILESTORE_PATH"

exec su-exec bun "$@"
