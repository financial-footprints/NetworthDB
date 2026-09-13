.PHONY: help install setup update upgrade dev kill check ci clean migrations

.DEFAULT_GOAL := help

help:
	@echo "Targets:"
	@echo "  help        List targets"
	@echo "  install     bun install"
	@echo "  setup       Copy .env, install, start Postgres, and migrate"
	@echo "  update      bun update within current version ranges"
	@echo "  upgrade     Latest Bun and all dependencies"
	@echo "  dev         Postgres + parallel API/web watch"
	@echo "  kill        Free app ports and stop Postgres"
	@echo "  check       biome, type-check, bun test, bruno"
	@echo "  ci          Same as check, no writes"
	@echo "  clean       Complete cleanup"
	@echo "  migrations  Generate Drizzle migrations from schema (name=<name> optional)"

install:
	bun install

setup: install
	cp -n src/apps/api/.env.example src/apps/api/.env 2>/dev/null || true
	cp -n src/apps/web/.env.example src/apps/web/.env 2>/dev/null || true
	docker compose up -d --wait
	bun run --filter @ndb/database migrate

migrations:
	bun run --filter @ndb/database generate $(name)

update:
	bun update

upgrade:
	bun upgrade
	bun update --latest

dev: kill setup
	bun run dev

kill:
	bash src/scripts/management/kill.sh

check: setup
	bun x biome check --write .
	bun run type-check
	bun run test
	bash src/scripts/tests/bruno.sh

ci: install
	bun x biome check .
	bun run type-check
	bun run test
	bash src/scripts/tests/bruno.sh

clean:
	rm -rf dist/
	docker compose down -v
