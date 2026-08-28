# Clubi — root task runner. Every target is invoked as `make <target>` — `mingw32-make <target>` on this system.
#
# Backend recipes go through `uv run`, which resolves the venv on its own —
# never activate one by hand. Each recipe line runs in its own shell, so the
# `cd` on one line does not leak into the next.
#
# The frontend is not scaffolded yet (see .claude/CLAUDE.md). Its steps are
# skipped while frontend/package.json is absent, so `install`, `types`, `build`
# and `check` stay usable until it lands and start working the day it does.

FRONTEND := $(wildcard frontend/package.json)

.DEFAULT_GOAL := help
.PHONY: help install dev-backend dev-frontend types migrate build check lint

help:
	@echo Clubi - available targets:
	@echo make install - install backend and frontend dependencies
	@echo make dev-backend - run the Django dev server on :8000
	@echo make dev-frontend - run the Vite dev server on :5173
	@echo make types - regenerate frontend/src/api/generated.ts from the API schema
	@echo make migrate - make and apply migrations
	@echo make build - build the SPA and collect static files
	@echo make check - Django check + pytest, then tsc + the SPA build
	@echo make lint - ruff check and format over the backend

install:
	cd backend && uv sync
ifneq ($(FRONTEND),)
	cd frontend && npm ci
else
	@echo Skipped npm ci: frontend/package.json does not exist yet
endif

dev-backend:
	cd backend && uv run manage.py runserver

dev-frontend:
ifneq ($(FRONTEND),)
	cd frontend && npm run dev
else
	@echo Nothing to run: the frontend has not been scaffolded yet
endif

types:
	cd backend && uv run manage.py export_openapi_schema --output ../openapi.json --indent 2
ifneq ($(FRONTEND),)
	cd frontend && npx openapi-typescript ../openapi.json -o src/api/generated.ts
else
	@echo Wrote openapi.json only: the frontend has not been scaffolded yet
endif

migrate:
	cd backend && uv run manage.py makemigrations && uv run manage.py migrate

build:
ifneq ($(FRONTEND),)
	cd frontend && npm run build
endif
	cd backend && uv run manage.py collectstatic --noinput

check:
	cd backend && uv run manage.py check && uv run pytest
ifneq ($(FRONTEND),)
	cd frontend && npx tsc --noEmit && npm run build
else
	@echo Skipped the frontend checks: it has not been scaffolded yet
endif

lint:
	cd backend && uv run ruff check . && uv run ruff format .
