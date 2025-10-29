# === VARIABLES ===
PROJECT_NAME = media-scraper
DOCKER_COMPOSE = docker compose
ARTILLERY = npx artillery
REPORT_DIR = tests
REPORT_BURST = $(REPORT_DIR)/report-burst.json
REPORT_BATCH = $(REPORT_DIR)/report-batch.json
REPORT_SMOKE = $(REPORT_DIR)/report-smoke.json

# === COMMANDS ===

.PHONY: help
help:
	@echo ""
	@echo "🚀 $(PROJECT_NAME) Commands:"
	@echo "--------------------------------------------"
	@echo "🟢 make start    -> Build, start, wait for health, run smoke + load tests"
	@echo "make up           -> Build & start all services (API, Worker, DB, Redis, Landing)"
	@echo "make down         -> Stop and remove containers"
	@echo "make logs         -> Tail logs for API + Worker"
	@echo "make smoke        -> Run smoke test (Artillery)"
	@echo "make load         -> Run load tests (burst + batch)"
	@echo "make clean        -> Stop and remove containers + volumes"
	@echo "--------------------------------------------"

# === CORE ===

start: setup
	@echo "🧱 [1/3] Building and starting $(PROJECT_NAME) services..."
	$(DOCKER_COMPOSE) up --build -d

	@echo "⏳ [2/3] Waiting for API healthcheck (up to 60 seconds)..."
	@bash -c 'for i in {1..30}; do \
		if curl -fs http://localhost:4000/health > /dev/null 2>&1; then \
			echo "\n✅ API is healthy!"; \
			break; \
		fi; \
		printf "."; \
		sleep 2; \
	done'

	@echo "🧪 [3/3] Running smoke test..."
	@if $(ARTILLERY) run tests/smoke-test.yml; then \
  	echo "✅ Smoke test passed!"; \
	else \
  	echo "❌ Smoke test failed!"; \
  	exit 1; \
	fi

	@echo "💥 Running load test (burst 5000 concurrent requests)..."
	$(ARTILLERY) run $(REPORT_DIR)/02_burst_5k_requests.yml --output $(REPORT_BURST)

	@echo "💥 Running load test (batch 500 requests x 10 URLs)..."
	$(ARTILLERY) run $(REPORT_DIR)/03_batch_5k_urls.yml --output $(REPORT_BATCH)

up: setup
	@echo "🧱 Building and starting $(PROJECT_NAME) services..."
	$(DOCKER_COMPOSE) up --build -d

	@echo ""
	@echo "🎉 All services started."
	@echo "--------------------------------------------"
	@echo "🌐 Frontend: http://localhost:3000"
	@echo "🔗 API:      http://localhost:4000"
	@echo "--------------------------------------------"

setup:
	@echo "🔍 Checking environment file..."
	@if [ ! -f .env ]; then \
		echo "⚙️  No .env found, creating one from .env.example..."; \
		cp .env.example .env; \
	else \
		echo "✅ .env file already exists."; \
	fi

	@for dir in backend landing; do \
		echo "📂 Copying .env → $$dir/.env ..."; \
		cp .env $$dir/.env; \
	done

down:
	@echo "🧹 Stopping services..."
	$(DOCKER_COMPOSE) down

logs:
	@echo "📜 Showing logs..."
	$(DOCKER_COMPOSE) logs -f api worker

logs-api:
	@echo "📜 Showing logs..."
	$(DOCKER_COMPOSE) logs -f api

logs-worker:
	@echo "📜 Showing logs..."
	$(DOCKER_COMPOSE) logs -f worker

logs-db:
	$(DOCKER_COMPOSE) logs -f postgres

logs-redis:
	$(DOCKER_COMPOSE) logs -f redis

clean:
	@echo "🔥 Removing containers and volumes..."
	$(DOCKER_COMPOSE) down -v
	rm -rf $(REPORT_DIR)/*.json $(REPORT_DIR)/*.html || true
	rm -f .env backend/.env landing/.env || true

clear-queue:
	@echo "🧹 Clearing queue inside API container..."
	docker exec api node dist/scripts/clear-queue.js || true

# === TESTS ===
smoke:
	@echo "✅ Running smoke test..."
	$(ARTILLERY) run $(REPORT_DIR)/01_smoke.yml --output $(REPORT_SMOKE)

load:
	@echo "💥 Running burst load test (~5000 concurrent requests)..."
	$(ARTILLERY) run $(REPORT_DIR)/02_burst_5k_requests.yml --output $(REPORT_BURST)
	@echo "🧹 Clearing queue before next test..."
	docker exec api node dist/scripts/clear-queue.js || true
	@echo "⏳ Waiting 5 seconds before next test..."
	sleep 5
	@echo "💥 Running batch load test (500 requests x 10 URLs)..."
	$(ARTILLERY) run $(REPORT_DIR)/03_batch_5k_urls.yml --output $(REPORT_BATCH)

