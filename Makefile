# Clubi — root task runner. Every target is invoked as `make <target>` — `mingw32-make <target>`
# on this system.
#
# Backend recipes go through `uv run`, which resolves the venv on its own —
# never activate one by hand. Each recipe line runs in its own shell, so the
# `cd` on one line does not leak into the next.

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
	cd frontend && npm ci

dev-backend:
	cd backend && uv run manage.py runserver

dev-frontend:
	cd frontend && npm run dev

types:
	cd backend && uv run manage.py export_openapi_schema --output ../openapi.json --indent 2
	cd frontend && npx openapi-typescript ../openapi.json -o src/api/generated.ts

migrate:
	cd backend && uv run manage.py makemigrations && uv run manage.py migrate

build:
	cd frontend && npm run build
	cd backend && uv run manage.py collectstatic --noinput

check:
	cd backend && uv run manage.py check && uv run pytest
	cd frontend && npx tsc --noEmit && npm run build

lint:
	cd backend && uv run ruff check . && uv run ruff format .
