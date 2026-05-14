# Convenience targets. Everything is reachable via pnpm scripts;
# the Makefile is for people who like `make up`.

.PHONY: help install up down logs migrate seed test lint typecheck build clean

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' Makefile | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install

up: ## Start postgres + redis + api + worker + dashboard
	docker compose up -d --build

down: ## Stop and remove containers
	docker compose down

logs: ## Tail logs from api + worker
	docker compose logs -f api worker

migrate: ## Apply pending migrations
	pnpm db:migrate

seed: ## Seed demo merchant + API key
	pnpm db:seed

test: ## Run all unit tests
	pnpm test

lint: ## Lint
	pnpm lint

typecheck: ## Typecheck
	pnpm typecheck

build: ## Build all packages and apps
	pnpm build

clean: ## Remove build artifacts and node_modules
	pnpm clean
