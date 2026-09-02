# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Clubi — the ESPM book club website. Django + Django Ninja backend serving a React/TypeScript SPA from a single origin.

**Current state: the whole backend is done — models, admin, auth and the API. The frontend has Fases 4 to 8 (Home, postagens, profiles, busca, catálogo externo), so every screen the guide's route table names is mounted and every phase of frontend work is closed. What is left is Fase 9, the deploy.** One round of product changes landed after Fase 8 without being a phase — see the `frontend/` line below and the two sections on postagens further down.

**On the phase numbers:** guide section 9 numbers the external-catalogue work **Fase 8** and the deploy **Fase 9**. This file and `frontend/CLAUDE.md` used to have them the other way round; the guide is the spec, so its numbering won and both were corrected during Fase 8. An older note calling the deploy "Fase 8" is the losing side of that.

Written and working:
- `users` — custom `User` (`full_name`, `birth_date`, `photo`, `quote`, `posts_seen_at`) plus a `favorites` M2M through `books.Favorite`; `users/schemas.py`, `users/api.py` (`me_router`, `users_router`). `MeOut` is the `/api/me` response and the only schema carrying `is_staff` (see below).
- `books` — `Book`, `MonthlyPick`, `MonthlyReading`, `Favorite`, with migrations and admin; `books/schemas.py`, `books/api.py` (`books_router`, `picks_router`). `MonthlyReading` stores its rating in half-stars (`rating_halves`, 0–10, with a `CheckConstraint`) and exposes it as 0–5 in steps of 0.5 through a `rating` property — see the ratings note below.
- `posts` — `Post`, `PostImage`, with migrations and admin; `posts/schemas.py`, `posts/api.py` (`posts_router`). **Writing is `is_staff`-only**, and the router also answers the unread count.
- `core` — no models; holds `core/images.py` (`compress_image`) and `core/static/css/auth.css`.
- Auth end to end: `SignupView`, `django.contrib.auth.urls`, pt-BR templates under `backend/templates/registration/`, email settings for password reset, and 17 tests in `users/test_auth.py`.
- `api` — no models, no routes of its own; only `api/api.py` (the `NinjaAPI` instance and the `add_router` calls) and `api/schemas.py` (the two shared projections). All 22 endpoints of the guide's section 6.2 map are mounted, plus two the map does not have (`GET /api/posts/unread`, `POST /api/posts/seen`); docs at `/api/docs`.
- API tests live with their app — `books/test_api.py`, `users/test_api.py`, `posts/test_api.py`, `api/test_api.py` — over shared fixtures in `backend/conftest.py`.

- `frontend/` — Fases 4 to 8 are done: Vite with the proxy, `src/api/client.ts`, TanStack Query, `styles/tokens.css` and `base.css` on the brand tokens, `Header`, `Footer`, `Home` with the monthly highlight and a working `ProgressBar`, the postagens screens (`Feed`, `NewPost`, `PostDetail`, `PostCard`), the profile screens (`Profile`, `EditProfile`, `StarRating` — a `role="slider"` with click, drag and arrow keys over the half-star scale — `FavoritesShelf`), the search (`Search` at `/search`, the `MemberSearch` field in the header, and `PickHistory` at `/book-of-the-month/history`), and the external catalogue inside `BookPicker` (`GET /api/books/external` plus `POST /api/books`, with `externalBook.ts` for the pure hit-to-`BookIn` mapping). `backend/templates/index.html` is the real SPA shell, loading the pinned Vite bundle. One round of changes landed after Fase 8 and is not a phase: the Home is now only the book and your reading of it (the postagens preview and the "quem está lendo" section are gone), "quem já terminou" is a folded panel inside the reading card, the header carries the balão into `/posts` with an unread badge, and "publicação" became "postagem" in every user-facing string. See `frontend/CLAUDE.md` for the folder's contract and `frontend/DESIGN.md` for anything visual.

Not written yet:
- Nothing on the frontend. Two things are *deliberately* absent rather than owed, and both are argued in `frontend/CLAUDE.md`: `BookOfTheMonth` (Fase 7 — the Home already is that screen, and `/book-of-the-month` redirects to it) and a "cadastro de livro" screen (Fase 8 — a book is registered from inside `BookPicker`, where the member already is, and anything the Open Library does not have is a job for the Admin, ADR-14).
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

**The binary is possibly not called `make` on this machine.** Make ships from MSYS2 here and is installed as `mingw32-make` (`C:\msys64\ucrt64\bin`) — there is no plain `make` on PATH, and Git Bash does not bundle one. So it is `mingw32-make check`, not `make check`. On Linux, macOS, WSL, or a Windows box that got make from Chocolatey or Scoop, the binary is `make`. If `make` returns "command not found", that is the reason — the Makefile is fine; reach for `mingw32-make` before concluding anything is broken.

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
- **A length limit on a `PatchDict` schema must live in `Annotated`, never on the right-hand side.** `create_patch_schema` rebuilds every non-optional field as `annotation = Optional[annotation]`, `default = getattr(cls, name, None)` — and on a pydantic model that `getattr` is `None`, so a `Field(max_length=...)` written as the default is *overwritten* and the limit silently disappears. An `Annotated[str, Field(max_length=...)]` rides inside the annotation and survives. This was a live bug on `PATCH /api/me` (a 200-character `full_name` into a 120-character column, 200 OK on SQLite, `DataError` → 500 on the Neon Postgres of ADR-13) and on `PATCH /api/posts/{id}`; both are fixed, and `users/test_api.py` and `posts/test_api.py` hold the regression tests.

**Monorepo, two folders, one deploy (ADR-03).** `backend/` and `frontend/`, built together, served by one Django process. `settings.py` already picks up `frontend/dist` as a staticfiles dir once it exists.

**Domain model (ADR-06 … ADR-08)** — the names carry meaning, keep them:
- `Book` — bibliographic record, no notion of "month". `author` is a `CharField`, not an FK (ADR-10).
- `MonthlyPick` — the club's choice for one month (`month` unique, first day of month). There is **no** `is_book_of_the_month` boolean; that would destroy history. Current pick via `MonthlyPick.current()`.
- `MonthlyReading` — one member's reading of one pick (progress, rating, review), unique per `(user, pick)`. It *is* the profile history; created lazily by `get_or_create` on the first progress click. Accessors: `user.monthly_readings`, `pick.readings`.

**Ratings are half-stars in the column and whole stars in the contract.** `MonthlyReading.rating_halves` is an integer 0–10 where one unit is half a star, bounded by a `CheckConstraint` (a NULL passes — most readings have no rating). Nothing outside the model should touch that column: the `rating` property converts both ways, so the admin, a shell session and `MonthlyReadingOut` all see 0–5 in steps of 0.5, and `MonthlyReadingIn` rejects anything off that grid with `multiple_of=0.5` (a 3.3 or an 11 is a 422). Doing the conversion in a schema instead would have left every non-API reader holding a 7. **`0` is a rating — zero stars — and it stopped meaning "sem nota".** Erasing one is `{"clear_rating": true}`, a field of its own: `update_reading` discards a `null` (which is what makes the `PUT` partial), and `GET /monthly-picks/current/readers` filters on `rating_halves IS NOT NULL`, so a member who erased a note must actually reach NULL instead of parking on 0. The reversibility DESIGN.md 9 asks for comes from that field now.
- `Favorite` / `PostImage` — fixed 4-slot lists modeled as rows with `position` and a 1–4 `CheckConstraint`. The shelf is saved by atomic replacement (`PUT /api/me/favorites`), not add/remove/reorder endpoints.

**Reading is the club's, writing is the organisation's.** `create_post`, `update_post`,
`delete_post` and `attach_image` refuse anyone without `is_staff` — 403, pt-BR — before they look
at authorship. The SPA needs to know, so `GET /api/me` answers with `MeOut`, a subclass of
`UserOut` that adds `is_staff` and exists precisely so the flag stays off `UserProfileOut` (which
also extends `UserOut`) and out of `UserBrief`, where it would have become project-wide vocabulary
(ADR-15, rule 3). Hiding the "Postar" shortcuts is courtesy; these four checks are the rule.

**Unread postagens are one stamp, not a table.** `User.posts_seen_at` compared against
`Post.created_at`: `GET /api/posts/unread` counts what is newer and not the member's own,
`POST /api/posts/seen` writes the stamp, and the SPA fires it when the feed mounts. A NULL stamp
means "never opened the feed", so everything counts — which is what every existing member got when
the column shipped, and what one visit settles. Per-post read receipts would have been a table
growing with members × postagens to answer a question a timestamp already answers.

**Custom user from day one (ADR-09).** `AUTH_USER_MODEL = "users.User"` was set before the first migration. Never reference `auth.User`; use `settings.AUTH_USER_MODEL` in FKs.

**Media goes to object storage (ADR-11).** `STORAGES["default"]` switches to Cloudflare R2 (`django-storages` S3 backend) as soon as `R2_BUCKET` is set, otherwise local `backend/media/`. Deploy filesystems are ephemeral, so R2 is a correctness requirement, not an optimization. Every image upload must pass through `core/images.compress_image` (1600px wide, JPEG q82).

**Types are generated, never hand-written (ADR-12).** `frontend/src/api/generated.ts` comes from the Ninja OpenAPI schema via `make types`. Regenerate after touching any `Schema`; `tsc --noEmit` is the guard.

**The Django Admin is a shipped product (ADR-14).** The founder operates the club through `/admin/` while the SPA is built. Configuring admin for a new model is part of adding that model, not a follow-up.

## Settings notes

`clubi/settings.py` reads env via `python-decouple` from `backend/.env` (see `.env.example`). `DEBUG=True` supplies an insecure dev `SECRET_KEY` fallback; with `DEBUG=False` a missing `SECRET_KEY` raises, HTTPS redirect/HSTS/secure cookies switch on, and staticfiles move to WhiteNoise's manifest storage.

Email is only used by the password reset. `EMAIL_BACKEND` defaults to the console backend under `DEBUG` and SMTP otherwise, so a deploy without SMTP configured breaks the reset silently. Reset links last 3 hours (`PASSWORD_RESET_TIMEOUT`).

The DB is currently local SQLite; production targets Neon Postgres via `DATABASE_URL` (ADR-13) — that wiring isn't in `settings.py` yet.

Locale is `pt-br` / `America/Sao_Paulo`, `USE_TZ=True` — use `timezone.localdate()` for "today".
