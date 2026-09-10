.PHONY: help install setup update upgrade dev kill check ci clean migrations migrate

.DEFAULT_GOAL := help

help:
	@echo "Targets:"
	@echo "  help      List targets"
	@echo "  install   bun install, NAPI debug build"
	@echo "  setup     Copy .env, install, start Postgres, and migrate"
	@echo "  update    cargo/bun update within current version ranges"
	@echo "  upgrade   Latest stable Rust, Bun, and all dependencies"
	@echo "  dev       Postgres + parallel app/logger watch"
	@echo "  kill      Free app ports and stop Postgres"
	@echo "  check     fmt, clippy, cargo test, biome, type-check, bun test, bruno"
	@echo "  ci        Same as check, no writes"
	@echo "  clean     Remove target and NAPI artifacts"
	@echo "  migrations  Generate Drizzle migrations from schema (name=<name> optional)"

install:
	bun install
	bun run --filter @ndb/logger build:debug

setup: install
	cp -n src/apps/api/.env.example src/apps/api/.env 2>/dev/null || true
	docker compose up -d
	$(MAKE) migrate

migrations:
	bun run --filter @ndb/database generate $(name)

migrate:
	bun run --filter @ndb/database migrate

update:
	cargo update --workspace
	bun update

upgrade:
	rustup update stable
	-cargo +stable install cargo-edit --locked
	cargo upgrade
	cargo update --workspace
	bun upgrade
	bun update --latest

dev: kill setup
	bun run dev

kill:
	bash src/scripts/management/kill.sh

check: setup
	cargo fmt
	cargo clippy --workspace --all-targets -- -D warnings
	cargo test --workspace
	bun x biome check --write .
	bun run type-check
	bun run test
	bash src/scripts/tests/bruno.sh

ci: install
	cargo fmt --check
	cargo clippy --workspace --all-targets -- -D warnings
	cargo test --workspace
	bun x biome check .
	bun run type-check
	bun run test
	bash src/scripts/tests/bruno.sh

clean:
	rm -rf dist/
	rm -f src/packages/logger/*.node
	rm -rf src/packages/.*.napi-stage-*
	rm -f src/packages/.napi-rs-*
	docker compose down -v
