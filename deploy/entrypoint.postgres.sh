#!/bin/sh
set -eu

SSL_DIR="/var/lib/postgresql/ssl"

if [ ! -f "$SSL_DIR/server.crt" ]; then
  mkdir -p "$SSL_DIR"
  openssl req -new -x509 -days 3650 -nodes \
    -subj "/CN=postgres" \
    -keyout "$SSL_DIR/server.key" \
    -out "$SSL_DIR/server.crt"
  chmod 600 "$SSL_DIR/server.key"
  chown -R postgres:postgres "$SSL_DIR"
fi

exec docker-entrypoint.sh postgres \
  -c ssl=on \
  -c ssl_cert_file="$SSL_DIR/server.crt" \
  -c ssl_key_file="$SSL_DIR/server.key"
