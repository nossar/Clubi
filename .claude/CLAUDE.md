# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Clubi — the ESPM book club website. Django + Django Ninja backend serving a React/TypeScript SPA from a single origin.

**Current state: the whole backend is done — models, admin, auth and the API. The frontend has Fases 4, 5 and 6 (Home, posts, profiles); Fase 7 (busca) is what is left of the screens.**

Written and working:
- `users` — custom `User` (`full_name`, `birth_date`, `photo`, `quote`) plus a `favorites` M2M through `books.Favorite`; `users/schemas.py`, `users/api.py` (`me_router`, `users_router`).
- `books` — `Book`, `MonthlyPick`, `MonthlyReading`, `Favorite`, with migrations and admin; `books/schemas.py`, `books/api.py` (`books_router`, `picks_router`).
- `posts` — `Post`, `PostImage`, with migrations and admin; `posts/schemas.py`, `posts/api.py` (`posts_router`).
- `core` — no models; holds `core/images.py` (`compress_image`) and `core/static/css/auth.css`.
- Auth end to end: `SignupView`, `django.contrib.auth.urls`, pt-BR templates under `backend/templates/registration/`, email settings for password reset, and 17 tests in `users/test_auth.py`.
- `api` — no models, no routes of its own; only `api/api.py` (the `NinjaAPI` instance and the `add_router` calls) and `api/schemas.py` (the two shared projections). All 22 endpoints of the guide's section 6.2 map are mounted; docs at `/api/docs`.
- API tests live with their app — `books/test_api.py`, `users/test_api.py`, `posts/test_api.py`, `api/test_api.py` — over shared fixtures in `backend/conftest.py`.

- `frontend/` — Fases 4, 5 and 6 are done: Vite with the proxy, `src/api/client.ts`, TanStack Query, `styles/tokens.css` and `base.css` on the brand tokens, `Header`, `Footer`, `Home` with the monthly highlight and a working `ProgressBar`, the posts screens (`Feed`, `NewPost`, `PostDetail`, `PostCard`), and the profile screens (`Profile`, `EditProfile`, `StarRating`, `FavoritesShelf`). `backend/templates/index.html` is the real SPA shell, loading the pinned Vite bundle. See `frontend/CLAUDE.md` for the folder's contract and `frontend/DESIGN.md` for anything visual.

Not written yet:
- The remaining SPA screens — `BookOfTheMonth`, `PickHistory` and `Search` (Fase 7). Their endpoints already exist; only the screens are missing.
- **One backend gap the frontend found and did not fix** (Fase 6, raised rather than acted on): `PatchDict[ProfileIn]` discards the schema's `max_length`, so `PATCH /api/me` writes a 200-character `full_name` into a 120-character column and answers 200 OK. SQLite does not check varchar length; the Neon Postgres of ADR-13 would raise `DataError` → 500. `EditProfile`'s `maxLength` attributes are the only length validation in the path today.
- The Neon Postgres wiring (see below). The root `Makefile` now exists and no longer gates the frontend steps.

Follow the phase order in the implementation guide rather than inventing structure.

## Reference documents (read before non-trivial work)

Two documents at the repo root are the spec for this project. The guide is gitignored (present locally only); the ADRs are versioned:

- `clubi-guia-de-implementacao.md` — the roadmap: repo structure, model code, admin, auth, endpoint map, schemas, frontend layout, deploy, and the phase-by-phase implementation order (section 9).
- `clubi-decisoes-de-arquitetura.md` — ADR-01 … ADR-17, the *why* behind each choice, including what was deliberately rejected.

A third document governs anything visual:

- `frontend/DESIGN.md` — the visual source of truth (ADR-17), distilled from the brandbook and assets in `frontend/clubi/`. Tokens, logo and element rules, interface tone, and a numbered register of extrapolations. **Mandatory reading before any frontend or CSS work**, including `backend/core/static/css/auth.css`, which the SPA shares tokens with. No colour, font, size, radius, shadow or tone may enter the code unless it is traceable to that document.

When a task touches modeling, API shape, or auth, check these first — the answer is usually already decided there. If you're about to contradict an ADR, say so explicitly rather than silently diverging.

## Language convention

**Code and commit messages are in English** — models, fields, routes, components, code comments, docstrings, and the whole git history.

**Documentation and everything a member reads are in Portuguese** — templates, form labels, `help_text`, validation and error messages, the reference documents above, and `backend/README.md`.

Preserve this split. A user-facing string in English is a bug; an English identifier is correct.

Commit subjects follow the existing history: plain English, imperative-past, no Conventional Commits prefix — `Added app Posts`, `Added signup form and view`.

## Commands

All backend commands run from `backend/`. `uv run` resolves the venv itself — never activate one manually.

```bash
uv sync                                # install (use --frozen in CI/deploy)
uv run manage.py runserver
uv run manage.py makemigrations && uv run manage.py migrate
uv run manage.py createsuperuser
uv run manage.py check
uv run pytest                          # pytest-django, settings from pyproject
uv run pytest users/test_auth.py::TestLogin::test_login_and_logout   # single test
uv run ruff check . && uv run ruff format .
uv add <pkg> / uv add --dev <pkg>
```

Test discovery is `test_*.py` (pyproject `[tool.pytest.ini_options]`), so a `tests.py` as generated by `startapp` is **not** collected — put tests in `test_*.py` files and delete the generated `tests.py`.

Ruff: line-length 100, migrations excluded. `select` is unset, so linting uses the default `E4`/`E7`/`E9`/`F`. Trailing-newline enforcement comes from `ruff format`, not from the linter — `ruff check` alone will not catch it, so run both.

The root `Makefile` exists and is the preferred entry point: `install`, `dev-backend`, `dev-frontend`, `types`, `migrate`, `build`, `check`, `lint`. Use it instead of growing ad-hoc scripts.

**The binary is not called `make` on this machine.** Make ships from MSYS2 here and is installed as `mingw32-make` (`C:\msys64\ucrt64\bin`) — there is no plain `make` on PATH, and Git Bash does not bundle one. So it is `mingw32-make check`, not `make check`. On Linux, macOS, WSL, or a Windows box that got make from Chocolatey or Scoop, the binary is `make`. If `make` returns "command not found", that is the reason — the Makefile is fine; reach for `mingw32-make` before concluding anything is broken.

While `frontend/package.json` is absent, the Makefile skips the frontend steps and echoes a `Skipped …` line for each. That gating is scaffolding: delete the `FRONTEND` variable and the `ifneq` blocks when the frontend is scaffolded, or a later `make check` can pass green having tested only the backend.

## Architecture — the load-bearing decisions

**Single origin, session auth (ADR-04).** The SPA is served by Django and talks to `/api/` with the Django session cookie plus an `X-CSRFToken` header. There is deliberately no CORS config and no JWT. In dev, Vite proxies `/api`, `/admin`, `/accounts`, `/media` to `:8000`. Do not introduce token auth or a second origin.

**Auth lives in rendered Django views, not the API (ADR-05).** `path("accounts/", include("django.contrib.auth.urls"))` plus a `SignupView`, which is declared *before* the include so it wins over the app's own patterns. There are no login/logout/password-reset endpoints in Ninja. The SPA's login signal is `GET /api/me` returning 401 → redirect to `/accounts/login/?next=…`.

`SignupForm` rejects an email that already exists (`iexact`): the model does not enforce uniqueness, and a shared address would make the password reset ambiguous.

**The SPA catch-all is a negative lookahead.** `clubi/urls.py` routes everything except `static/`, `media/`, `api/`, `admin/` and `accounts/` to the shell. An unmounted route must 404, not render the shell — otherwise a typo'd API path silently returns HTML.

**Django Ninja, not DRF (ADR-02).** All endpoints under `/api/`, Pydantic `Schema`/`ModelSchema`, docs at `/api/docs`.

**Each app owns its slice of the API (ADR-15).** Models, schemas and routes for a domain live in that domain's app: `books/models.py` + `books/schemas.py` + `books/api.py`. `api/` is not a facade — it holds the `NinjaAPI` instance and nothing else except the shared projections. When you add an endpoint, it goes in the app that owns the models behind it; only the `add_router` line goes in `api/api.py`.

Four rules follow from that, and they are the ones to hold onto:

1. **Two kinds of schema, and only one is shareable.** *Projections* (`BookOut`, `UserBrief`) describe one entity, import no other schema, and exist to be embedded. *Response shapes* (`PostOut`, `ReaderOut`, `UserProfileOut`) describe what one endpoint returns.
2. **Response shapes live with the route, not with the entity they cite.** `ReaderOut` is in `books/schemas.py` — not `users/` — because it is the return type of `GET /api/monthly-picks/current/readers`. Filing it under the entity is exactly what would create the `books ↔ users` cycle.
3. **`api/schemas.py` holds only `BookOut` and `UserBrief`.** Adding a third projection needs a reason; each one becomes project-wide vocabulary. Never move a schema there just to dodge an import.
4. **Cross-app schema imports stay one-directional.** Today there is exactly one: `users/schemas.py` imports `ReadingHistoryOut` from `books`. `books` must never import from `users`, and `posts` imports from neither. The dependency graph is `books → api/schemas`, `posts → api/schemas`, `users → api/schemas` + `books`.

Prefix, `auth` and `tags` are set at the mount point in `api/api.py`, never inside the app — `api/api.py` is the one file that shows the whole surface.

`api/api.py` also overrides `get_openapi_operation_id` to return the bare view name. Ninja's default is `<module>_<view>`, which would leak the file layout into the generated frontend client and churn it on every move. **The cost is that view names must be unique across the whole API, not just within an app** — `api/test_api.py` fails if two collide or if an id starts carrying module names again. Pick a distinct view name when adding a route.

Three things about the Ninja wiring that are easy to get wrong:
- `NinjaAPI` takes no `csrf=` argument (the guide's snippet predates Ninja 1.x). CSRF is enforced by the auth class — `django_auth` checks it on every unsafe method by default. Do not add `csrf_exempt` anywhere.
- Multipart on `PUT` needs `ninja.compatibility.files.fix_request_files_middleware` in `MIDDLEWARE`; Django only fills `request.FILES` on POST. `PUT /api/me/photo` depends on it.
- Partial updates use `PatchDict[Schema]`, which widens every field to optional. The routes re-narrow it: a `null` for a field the model stores as a blank string becomes `""`, and only genuinely nullable fields (`birth_date`, `Post.book_id`) accept `null`.

**Monorepo, two folders, one deploy (ADR-03).** `backend/` and `frontend/`, built together, served by one Django process. `settings.py` already picks up `frontend/dist` as a staticfiles dir once it exists.

**Domain model (ADR-06 … ADR-08)** — the names carry meaning, keep them:
- `Book` — bibliographic record, no notion of "month". `author` is a `CharField`, not an FK (ADR-10).
- `MonthlyPick` — the club's choice for one month (`month` unique, first day of month). There is **no** `is_book_of_the_month` boolean; that would destroy history. Current pick via `MonthlyPick.current()`.
- `MonthlyReading` — one member's reading of one pick (progress, rating, review), unique per `(user, pick)`. It *is* the profile history; created lazily by `get_or_create` on the first progress click. Accessors: `user.monthly_readings`, `pick.readings`.
- `Favorite` / `PostImage` — fixed 4-slot lists modeled as rows with `position` and a 1–4 `CheckConstraint`. The shelf is saved by atomic replacement (`PUT /api/me/favorites`), not add/remove/reorder endpoints.

**Custom user from day one (ADR-09).** `AUTH_USER_MODEL = "users.User"` was set before the first migration. Never reference `auth.User`; use `settings.AUTH_USER_MODEL` in FKs.

**Media goes to object storage (ADR-11).** `STORAGES["default"]` switches to Cloudflare R2 (`django-storages` S3 backend) as soon as `R2_BUCKET` is set, otherwise local `backend/media/`. Deploy filesystems are ephemeral, so R2 is a correctness requirement, not an optimization. Every image upload must pass through `core/images.compress_image` (1600px wide, JPEG q82).

**Types are generated, never hand-written (ADR-12).** `frontend/src/api/generated.ts` comes from the Ninja OpenAPI schema via `make types`. Regenerate after touching any `Schema`; `tsc --noEmit` is the guard.

**The Django Admin is a shipped product (ADR-14).** The founder operates the club through `/admin/` while the SPA is built. Configuring admin for a new model is part of adding that model, not a follow-up.

## Settings notes

`clubi/settings.py` reads env via `python-decouple` from `backend/.env` (see `.env.example`). `DEBUG=True` supplies an insecure dev `SECRET_KEY` fallback; with `DEBUG=False` a missing `SECRET_KEY` raises, HTTPS redirect/HSTS/secure cookies switch on, and staticfiles move to WhiteNoise's manifest storage.

Email is only used by the password reset. `EMAIL_BACKEND` defaults to the console backend under `DEBUG` and SMTP otherwise, so a deploy without SMTP configured breaks the reset silently. Reset links last 3 hours (`PASSWORD_RESET_TIMEOUT`).

The DB is currently local SQLite; production targets Neon Postgres via `DATABASE_URL` (ADR-13) — that wiring isn't in `settings.py` yet.

Locale is `pt-br` / `America/Sao_Paulo`, `USE_TZ=True` — use `timezone.localdate()` for "today".
