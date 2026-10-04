# Local development only. Loads .env.dev into the environment, where it takes
# precedence over .env for Next.js and Prisma, so .env is left untouched.
ENV_FILE ?= .env.dev

ifneq (,$(wildcard $(ENV_FILE)))
include $(ENV_FILE)
export
endif

APP_PORT ?= 3001

COMPOSE = docker compose --env-file $(ENV_FILE)

.PHONY: help check-env check-local-db up down logs psql dev migrate seed studio app app-rebuild

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "%-12s %s\n", $$1, $$2}'

check-env:
	@test -f $(ENV_FILE) || { echo "$(ENV_FILE) is missing. Create it with: cp .env.dev.example $(ENV_FILE)"; exit 1; }

check-local-db: check-env
	@case "$(DATABASE_URL)" in \
	  *@localhost[:/]*|*@127.0.0.1[:/]*) ;; \
	  *) echo "DATABASE_URL does not point to localhost, aborting."; exit 1;; \
	esac

up: check-env ## Start the database
	$(COMPOSE) up -d --wait db

down: check-env ## Stop the services (data is kept)
	$(COMPOSE) down

logs: check-env ## Follow the logs
	$(COMPOSE) logs -f

psql: check-env ## Open a Postgres console
	$(COMPOSE) exec db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

dev: check-local-db ## Run Stickly on the host against the local database
	npm run dev -- --port $(APP_PORT)

migrate: check-local-db ## Apply migrations to the local database
	npx prisma migrate dev

seed: check-local-db ## Load the demo data into the local database
	npm run db:seed

studio: check-local-db ## Open Prisma Studio on the local database
	npx prisma studio

app: check-env ## Run the database and the app, both in Docker
	$(COMPOSE) up -d app

app-rebuild: check-env ## Rebuild the app image (after changing dependencies) and start it
	$(COMPOSE) up -d --build --renew-anon-volumes app
