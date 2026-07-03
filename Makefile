# Onion Loop Memory Guard — one environment, one command each.
.DEFAULT_GOAL := help
.PHONY: help demo test bench check scenario docker clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

demo: ## Serve the console + API at http://localhost:4173
	node server/server.js

test: ## Run the invariant test suite (deterministic, revocation, temporal, audit, inference)
	node --test

bench: ## Prove sub-200ms P99 permission checks
	node bench/p99.js

scenario: ## Emit JSON scenario + full decision matrix to scenarios/
	node scripts/emit-scenario.js

check: test bench ## Run tests and the benchmark

docker: ## Build and run the demo in Docker
	docker compose up --build

clean: ## Remove generated artifacts
	rm -f scenarios/demo-scenario.json scenarios/decision-matrix.json
