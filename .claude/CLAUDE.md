# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Clubi — the ESPM book club website. Django + Django Ninja backend serving a React/TypeScript SPA from a single origin.

**State: backend and frontend are both complete and run locally; the deploy has not happened.** What is still open is the guide's Fase 9 — the deploy and the Neon Postgres wiring it needs.

Two folders, and each has its own `CLAUDE.md` with the rules that only apply there:

- `backend/` — Django apps `users`, `books`, `posts`, `core`, `api`. See `backend/CLAUDE.md`.
- `frontend/` — the SPA. See `frontend/CLAUDE.md`, and `frontend/DESIGN.md` for anything visual.

## Reference documents (read before non-trivial work)

Two documents at the repo root are the spec for this project. The guide is gitignored (present locally only); the ADRs are versioned:

- `clubi-guia-de-implementacao.md` — the roadmap: repo structure, model code, admin, auth, endpoint map, schemas, frontend layout, deploy, and the phase-by-phase implementation order (section 9).
- `clubi-decisoes-de-arquitetura.md` — ADR-01 … ADR-18, the *why* behind each choice, including what was deliberately rejected.

A third document governs anything visual:

- `frontend/DESIGN.md` — the visual source of truth (ADR-17), distilled from the brandbook and assets in `frontend/clubi/`. Tokens, logo and element rules, interface tone, and a numbered register of extrapolations. **Mandatory reading before any frontend or CSS work**, including `backend/core/static/css/`, which the SPA shares tokens with. No colour, font, size, radius, shadow or tone may enter the code unless it is traceable to that document.

When a task touches modeling, API shape, or auth, check these first — the answer is usually already decided there. If you're about to contradict an ADR, say so explicitly rather than silently diverging.

## Language convention

**Code and commit messages are in English** — models, fields, routes, components, code comments, docstrings, and the whole git history.

**Documentation and everything a member reads are in Portuguese** — templates, form labels, `help_text`, validation and error messages, the reference documents above, and `backend/README.md`.

Preserve this split. A user-facing string in English is a bug; an English identifier is correct.

Commit subjects follow the existing history: plain English, imperative-past, no Conventional Commits prefix — `Added app Posts`, `Added signup form and view`.

## Commands

The root `Makefile` is the preferred entry point: `install`, `dev-backend`, `dev-frontend`, `types`, `migrate`, `build`, `check`, `lint`. Use it instead of growing ad-hoc scripts. The per-folder commands are in `backend/CLAUDE.md` and `frontend/CLAUDE.md`.

**The binary is possibly not called `make` on this machine.** Make ships from MSYS2 here and is installed as `mingw32-make` (`C:\msys64\ucrt64\bin`) — there is no plain `make` on PATH, and Git Bash does not bundle one. So it is `mingw32-make check`, not `make check`. On Linux, macOS, WSL, or a Windows box that got make from Chocolatey or Scoop, the binary is `make`. If `make` returns "command not found", that is the reason — the Makefile is fine; reach for `mingw32-make` before concluding anything is broken.

## Architecture — what crosses the folder boundary

**Monorepo, two folders, one deploy (ADR-03).** `backend/` and `frontend/`, built together, served by one Django process.

**Single origin, session auth (ADR-04).** The SPA is served by Django and talks to `/api/` with the Django session cookie plus an `X-CSRFToken` header. There is deliberately no CORS config and no JWT. In dev, Vite proxies `/api`, `/admin`, `/accounts`, `/media` and `/static` to `:8000`. Do not introduce token auth or a second origin.

**Auth lives in rendered Django views, not the API (ADR-05).** There are no login/logout/password-reset endpoints in Ninja; the pages are served under `/accounts/`. The SPA's login signal is `GET /api/me` returning 401 → redirect to `/accounts/login/?next=…`.

**Django Ninja, not DRF (ADR-02).** All endpoints under `/api/`, Pydantic `Schema`/`ModelSchema`, docs at `/api/docs`. Each app owns its own schemas and routes (ADR-15) — the rules are in `backend/CLAUDE.md`.

**The SPA catch-all is a negative lookahead.** `clubi/urls.py` routes everything except `static/`, `media/`, `api/`, `admin/` and `accounts/` to the shell. An unmounted route must 404, not render the shell — otherwise a typo'd API path silently returns HTML. `/` is the one exception (ADR-18).

**Domain model (ADR-06 … ADR-08)** — the names carry meaning, keep them:
- `Book` — bibliographic record, no notion of "month".
- `MonthlyPick` — the club's choice for one month (`month` unique, first day of month). There is **no** `is_book_of_the_month` boolean; that would destroy history.
- `MonthlyReading` — one member's reading of one pick (progress, rating, review), unique per `(user, pick)`. It *is* the profile history.

**Reading is the club's, writing is the organisation's.** Creating, editing and deleting a postagem, and attaching an image, are `is_staff`-only and refused with a 403 in pt-BR. `GET /api/me` is the only response carrying `is_staff`. Hiding the "Postar" shortcuts is courtesy; the backend check is the rule.

**Tokens live in two files that must stay identical.** `backend/core/static/css/tokens.css` and `frontend/src/styles/tokens.css` are declared twins — same names, same values. Changing a token means changing both, and `frontend/DESIGN.md` before either (ADR-18).

**Types are generated, never hand-written (ADR-12).** `frontend/src/api/generated.ts` comes from the Ninja OpenAPI schema via `make types`. Regenerate after touching any `Schema`; `tsc --noEmit` is the guard.

**The Django Admin is a shipped product (ADR-14).** The founder operates the club through `/admin/`, which is why some things the SPA never gets a screen for are not missing features. Configuring admin for a new model is part of adding that model, not a follow-up.
