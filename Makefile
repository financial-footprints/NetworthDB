.PHONY: help install setup update upgrade dev kill check ci clean migrations

.DEFAULT_GOAL := help

help:
	@echo "Targets:"
	@echo "  help        List targets"
	@echo "  install     bun install"
	@echo "  setup       Copy .env, install, start Docker infra, and migrate"
	@echo "  update      bun update within current version ranges"
	@echo "  upgrade     Latest Bun and all dependencies"
	@echo "  dev         Docker infra + parallel API, web, and Copilot HTTP"
	@echo "  kill        Free app ports and stop Docker infra"
	@echo "  check       biome, markdownlint, type-check, test, catalog, depcruise, bruno"
	@echo "  ci          Same as check, no writes"
	@echo "  clean       Remove deps, build artifacts, caches; stop Docker infra"
	@echo "  migrations  Generate Drizzle migrations from schema (name=<name> optional)"

install:
	bun install

setup: install
	cp -n src/apps/api/.env.example src/apps/api/.env 2>/dev/null || true
	cp -n src/apps/web/.env.example src/apps/web/.env 2>/dev/null || true
	cp -n src/apps/copilot/.env.example src/apps/copilot/.env 2>/dev/null || true
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
	bun run --filter @ndb/database migrate:test
	bun x biome check --write .
	bun x markdownlint **/*.md --fix
	bun x biome check .
	bun x markdownlint **/*.md
	bun run type-check
	bun run test
	bun run validate:card-catalog
	bun x depcruise src/packages src/apps --config dependency-cruiser.config.mjs
	bash src/scripts/tests/bruno.sh

ci: install
	bun x biome check .
	bun x markdownlint **/*.md
	bun run type-check
	bun run test
	bun run validate:card-catalog
	bun x depcruise src/packages src/apps --config dependency-cruiser.config.mjs
	bash src/scripts/tests/bruno.sh

clean:
	docker compose down -v
	find . -name node_modules -type d -prune -exec rm -rf {} +
	find . \( -name dist -o -name out \) -type d -prune -exec rm -rf {} +
	find . -name .run -type d -prune -exec rm -rf {} +
	find . -name '*.tsbuildinfo' -type f -delete
