# Convenience wrappers around the Dockerized Astro build/serve workflow.
# Everything runs in Docker — you only need Docker installed. Run `make` for the list.

COMPOSE := docker compose
TOOLS   := $(COMPOSE) --profile tools run --rm
URL     := http://localhost:4321

.DEFAULT_GOAL := help
.PHONY: help up down rebuild dist restart logs ps test extract open clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  \033[36m%-9s\033[0m %s\n", $$1, $$2}'

up: ## Build + serve at http://localhost:4321 (re-run to rebuild after edits)
	$(COMPOSE) up -d --build
	@echo "→ serving at $(URL)"

down: ## Stop and remove the containers
	$(COMPOSE) down

rebuild: ## Rebuild just the web service after content/code changes
	$(COMPOSE) up -d --build web
	@echo "→ rebuilt, serving at $(URL)"

dist: ## Export a clean, deploy-ready static build to ./dist (for `wrangler pages deploy dist`)
	$(COMPOSE) up -d --build web
	@rm -rf dist && mkdir dist
	$(COMPOSE) cp web:/usr/share/nginx/html/. dist
	@rm -f dist/50x.html
	@echo "→ exported clean dist/ ($$(find dist -type f | wc -l | tr -d ' ') files)"

restart: ## Restart the running web container (no rebuild)
	$(COMPOSE) restart web

logs: ## Follow the web server logs
	$(COMPOSE) logs -f web

ps: ## Show container status
	$(COMPOSE) ps

test: ## Run the content-pipeline unit tests (Vitest)
	$(TOOLS) test

extract: ## Regenerate content from the WordPress source (requires that source running)
	$(TOOLS) extract

open: ## Open the site in your browser
	@open $(URL) 2>/dev/null || xdg-open $(URL) 2>/dev/null || echo "Open $(URL)"

clean: ## Stop and remove the built image + tool volumes (frees disk)
	$(COMPOSE) down --rmi local -v
