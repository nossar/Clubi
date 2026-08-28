# CLAUDE.md — frontend

**Scope rule.** The root `.claude/CLAUDE.md` loads in every session and is authoritative for
everything project-wide: the language convention, the ADRs, the domain model, the Ninja wiring, the
backend commands. This file loads on demand, when Claude reads files under `frontend/`, and carries
only what is specific to this folder. The two are concatenated, never overridden — so a rule
restated here is a second copy that will drift, and the drift stays invisible until they disagree.
If something written here turns out to apply project-wide, move it up instead of copying it.

Section 7 of `clubi-guia-de-implementacao.md` is this folder's spec: Vite config (7.1), `client.ts`
verbatim (7.2), generated types (7.3), layout and route table (7.4), state rules (7.5), a worked
`ProgressBar` (7.6), design (7.7). The ADRs that constrain this folder are 03, 04, 05, 12, 16 and 17.

**[DESIGN.md](DESIGN.md) is the visual source of truth and is a prerequisite for every frontend
task** (ADR-17). It distils the brandbook in `frontend/clubi/` into tokens, logo and element rules,
interface tone, and a numbered list of extrapolations. No colour, font, size, radius, shadow or
tone decision may enter the code without being traceable to it. Read it before writing CSS, before
building a component, and before briefing any design skill. A value invented in a component is a
process bug even when it looks fine — the fix is to add it to DESIGN.md with its justification.

## Current state

**Fase 4 is done.** Vite with the proxy, `client.ts`, TanStack Query, `styles/tokens.css` and
`base.css`, `Header`, `Footer`, and `Home` with the monthly highlight and a working `ProgressBar`.
You open `/`, see the book of the month, and update your progress through the UI.

What is here:

- [DESIGN.md](DESIGN.md) — the visual source of truth (ADR-17). E-01 … E-12 were reviewed by the
  founder on 2026-08-27; **E-13 (component dimensions, section 8.7) came out of Fase 4 and is the
  only one still open.**
- `clubi/` — the brand assets themselves: brandbook PDF, logo variants, the two font families,
  graphic elements, and the published social pieces. Read-only input to DESIGN.md; never edit
  these, and never derive a value from them without recording it in DESIGN.md.
- `src/` — the SPA. `Home` is the only route mounted; `App.tsx` answers everything else with a
  pt-BR not-found screen, because Django's catch-all hands the shell every path it does not own.

Next up is the guide's **Fase 5** (posts): `Feed`, `NewPost`, `PostDetail` and `PostCard` — and
that is when `PostCard` starts rendering on the Home, which has no posts today. The backend for it
has been finished since before Fase 4; only the screens are missing. Follow the phase order rather
than building screens out of sequence.

Three things that already bit once, so they are worth knowing before touching the setup:

- Clash Semibold declares itself as family `"Clash Display Semibold"`, so `@font-face` renames it
  to `"Clash Display"` weight 600. Undo that and `font-weight` silently stops working.
- **`vite.config.ts` proxies `/static` too**, alongside `/api`, `/admin`, `/accounts` and `/media`
  — fonts and the logo are served by Django from `/static/brand/` (DESIGN.md 2.1), and without it
  the dev server renders in system fonts with no error to tell you why.
- **That proxy also rewrites `Origin` and `Host` to the Django target.** The browser is right that
  a POST from the SPA is same-origin, but Django is handed `Origin: http://localhost:5173` while
  answering on `:8000`, and its CSRF origin check rejects the mismatch. Without the rewrite every
  unsafe request in development 403s — login, logout and the progress `PUT` included.

`typescript` is pinned to the 5.x line on purpose: TypeScript 7's native port drops the
`ts.factory` API that `openapi-typescript` builds on, so `make types` dies on it.

Every string the SPA renders is user-facing, so it is pt-BR — labels, buttons, empty states, error
copy, `aria-label`, and `Intl` formatting for dates and numbers. Identifiers stay English.

## Commands

Run them from `frontend/`, or prefer the root `Makefile` targets that wrap them.

```bash
npm install                # npm ci in CI/deploy
npm run dev                # Vite dev server; needs manage.py runserver on :8000
npm run build              # emits frontend/dist, which Django picks up as a staticfiles dir
npx tsc --noEmit           # the contract guard (ADR-12) — run after touching API types
```

`make types` is the only supported way to regenerate `src/api/generated.ts`:

```makefile
types:
	cd backend && uv run manage.py export_openapi_schema --output ../openapi.json
	cd frontend && npx openapi-typescript ../openapi.json -o src/api/generated.ts
```

## Stack

React, TypeScript, Vite, React Router, TanStack Query, and plain CSS. That is the whole list.

Deliberately absent: no CORS config, no JWT or token storage, no auth screens in React, no SSR or
meta-framework, no state library beyond the Query cache, no UI kit or CSS framework (7.7 — a kit is
what makes a site look templated). Adding any of them is a deviation to raise before writing it.

## Tooling (ADR-16)

**Chrome DevTools MCP** is configured for this repo in `.mcp.json`, so no setup is needed. Drive it
against the **Vite dev server on `:5173`** with Django up on `:8000` — that is the pair that
exercises the proxy; opening `:8000` directly tests an arrangement that exists in neither dev nor
production. Local environment only: never production, and never `/admin/`, which holds real member
data. The agent can log itself in through the rendered form at `/accounts/login/` and the session
cookie holds for the rest of the run; do not build a test-only bypass around it.

**The `frontend-design` skill** (vendored in `.claude/skills/frontend-design/`) is for one job,
once: producing `styles/tokens.css` in Fase 4. **Brief it with [DESIGN.md](DESIGN.md) section 11 —
the brand palette is `#88013e` wine, `#fdfae7` cream, `#ffd071` yellow, `#ed6630` orange, with
Clash Display for display and Manrope for text.** Those come from the brandbook and are not open
for the skill to reinterpret; neither are the contrast rules in section 3.2, which are measured.
What is still open is what DESIGN.md leaves open: layout concept, signature element, and how the
collage language of section 7 shows up on screen.

ADR-16b originally pinned `#f6f2ea`/`#7a2e2e`/Inter here. Those values were improvised in the auth
phase and never came from the brand — ADR-17 replaces them. Do not reintroduce them, and do not let
a later run "fix" the palette into anything not in DESIGN.md.

**No generated API client.** Hey API and its TanStack Query plugin were evaluated and rejected in
ADR-16c: `client.ts` and the queryKey table below are hand-written on purpose, not for lack of a
generator. Read that ADR before proposing one.

## Talking to the API

**`src/api/client.ts` is the only file that calls `fetch`.** Guide 7.2 has it verbatim: prefixes
`/api`, sends `credentials: "same-origin"`, attaches `X-CSRFToken` from the cookie, redirects to
`/accounts/login/?next=…` on 401, throws `ApiError(status, detail)` otherwise. Components go
through TanStack Query and never touch `fetch`, `axios`, or an absolute URL. That 401 redirect is
the whole login flow (ADR-05) — the SPA has no `/login` route.

Logout is not a fetch either: `Header` posts a plain HTML form to `/accounts/logout/` with the
`csrfmiddlewaretoken` read from the same cookie, because `LogoutView` refuses GET and the view
belongs to `django.contrib.auth`, not to the API.

**`src/api/generated.ts` is generated and never edited by hand** (ADR-12), not even to fix a type.
`src/api/types.ts` is the thin hand-written layer over it:

```ts
import type { components } from "./generated";
export type Book = components["schemas"]["BookOut"];
export type User = components["schemas"]["UserOut"];
```

Operation ids are bare view names (`read_me`, `list_posts`), so generated identifiers stay stable
when a route moves between backend apps.

## Layout and routes

```
frontend/
├── DESIGN.md                     # visual source of truth (ADR-17) — read before styling
├── clubi/                        # brand assets: brandbook, logo, fonts, elements, social pieces
└── src/
    ├── main.tsx                  # QueryClient + router mount
    ├── App.tsx                   # routes
    ├── format.ts                 # pt-BR date formatting (Intl), shared by components
    ├── assets/    elements/ (10 svg, currentColor). Fonts and the logo live in
    │              backend/core/static/brand/ — one copy, both surfaces (DESIGN.md 2.1)
    ├── api/       client.ts, generated.ts, types.ts
    ├── context/   CurrentUser.tsx
    ├── routes/    Home, Feed, NewPost, PostDetail, Profile, EditProfile,
    │              BookOfTheMonth, PickHistory, Search
    ├── components/ Header, Footer, PostCard, MonthlyPickHighlight,
    │              ProgressBar, StarRating, FavoritesShelf, BookCover,
    │              BrandElement, ReadersList
    └── styles/    tokens.css, base.css
```

Written so far: everything above except `PostCard`, `StarRating`, `FavoritesShelf`, and every
route other than `Home`. `BrandElement` (inlines a brand SVG so `currentColor` applies) and
`ReadersList` ("quem está lendo", on the Home) were added in Fase 4 and are not in guide 7.4.

| Route | Component | | Route | Component |
|---|---|---|---|---|
| `/` | `Home` | | `/profile/edit` | `EditProfile` |
| `/posts` | `Feed` | | `/book-of-the-month` | `BookOfTheMonth` |
| `/posts/new` | `NewPost` | | `/book-of-the-month/history` | `PickHistory` |
| `/posts/:id` | `PostDetail` | | `/search` | `Search` |
| `/u/:username` | `Profile` | | | |

`PostCard` renders on Home, Feed and Profile. Write it once; three near-copies is how they diverge.

## State rules

Three disciplines Django used to enforce for free (guide 7.5):

1. **Anything derivable from the URL lives in the URL.** Page, search term and filters use
   `useSearchParams`, never `useState` — otherwise F5, the back button and shared links break.
2. **The top component fetches.** Children take props and do not call `api()`. Ten `PostCard`s must
   not become ten requests and ten independent copies of the same data.
3. **Cache with explicit invalidation.** `queryKey` mirrors the API route; after a write,
   invalidate *every* key that displays the affected data.

| Data | `queryKey` | Invalidate after |
|---|---|---|
| Book of the month | `["monthly-pick", "current"]` | (practically never) |
| My reading | `["reading", "current"]` | saving progress or a rating |
| Who is reading | `["readers", "current"]` | saving progress |
| Feed | `["posts", page]` | creating, editing or deleting a post |
| Profile | `["user", username]` | editing the profile, saving favorites |
| Current user | `["me"]` | editing the profile |

`main.tsx` defaults: `staleTime: 30_000`, `refetchOnWindowFocus: false`, and `retry: false`. The
last one is not in guide 7.5 and is deliberate: this API's non-200s are states, not blips. A 404 on
`/monthly-picks/current` means there is no pick this month, and a 401 has already sent the browser
to `/accounts/login/` — retrying either only fires requests at a page that is navigating away.

## Response shapes that decide component design

`/api/docs` has the full contract. These are the ones that change how a component is built:

- **The feed is a `Page`, not a list**: `{ items, total, page, has_next }`, params `page` and `size`
  (default 10). Paginate off `has_next`.
- **Errors are `{ "detail": "..." }`**, already in Portuguese. Render `detail` instead of inventing
  a message.
- **Images are URL strings, never objects.** `cover_image` is a string (`""` when absent), `photo`
  is a string or `null`, `PostOut.images` is a `string[]` of at most 4. `BookCover` needs a
  placeholder.
- **`GET /api/monthly-picks/current` 404s when no pick is set** — Home renders an "ainda não há
  livro do mês" state rather than breaking.
- **Progress is one `PUT`** to `/monthly-picks/current/reading` with any of `pages_read`, `rating`,
  `review`. `percent` is `null` when the book has no page count; over the total is a 400.
- **The shelf is replaced whole**: `PUT /api/me/favorites` with positions 1–4. Reorder in local
  state, then PUT.
- **On `PATCH`, clear a text field with `""`, not `null`** — only `birth_date` and `Post.book_id`
  accept `null`.
- **Uploads are multipart**: `PUT /api/me/photo` (max 8 MB) and `POST /api/posts/{id}/images`
  (max 4), both field `file`. A post with images is two requests. `client.ts` hardcodes
  `Content-Type: application/json`, so a `FormData` body must override that header away and let the
  browser set the boundary.

## Styling

Tokens first, components second (7.7). **The canonical token block is section 11 of
[DESIGN.md](DESIGN.md)** — copy it into `styles/tokens.css` rather than inventing values, and read
sections 3 through 10 for the rules that govern how they are used.

`styles/tokens.css` and [backend/core/static/css/auth.css](../backend/core/static/css/auth.css)
must carry the same values. The rendered `/accounts/` pages and the SPA are the same site; the
visible seam between them is ADR-05's one real downside, and shared tokens are the stated
mitigation. Changing a token means changing both files — and DESIGN.md first.

`auth.css` used to disagree with DESIGN.md — it shipped with an improvised palette (`#f6f2ea`,
`#7a2e2e`, Inter) that predated anyone reading the brandbook. It was realigned on 2026-08-27, and
`tokens.css` was copied from DESIGN.md section 11 to match. The two files are in step; keep them
that way (ADR-17), because the seam ADR-05 promised to hide is on every member's first login.

Three rules from DESIGN.md that decide component structure, so they are worth knowing before you
open a file:

- **Body text is wine on cream, or cream on wine** (9.43:1). Orange and yellow are measured to fail
  as body text — orange is for large type, buttons and highlights; yellow only ever sits on wine.
- **Collage lives in the frame, not the machinery.** Hero, empty state, footer and invitation cards
  carry the texture, stickers and rotation. Forms, the feed, `ProgressBar` and reader lists stay
  clean and aligned.
- **There is no icon library and there will not be one** (DESIGN.md 6.3, decided in E-07). Where an
  icon means something, use a brand element — `estrela-5` is `StarRating`, `clips` is attach,
  `balao` is a post. Where it is a control, use a word: "Publicar", "Ver mais", "Excluir", and a
  search field with a placeholder rather than a magnifier. Fases 4–6 need zero functional icons. Do
  not install Lucide, Feather or Heroicons — that is a deviation to raise, not a default.
- **The tone is anti-metric and it is load-bearing** (DESIGN.md section 9). No ranking, no streaks,
  no "you're behind", no red for low progress. `ProgressBar` and `StarRating` are the two
  components most likely to get this wrong.

## Build and the SPA shell

`npm run build` writes `frontend/dist`, which `settings.py` adds to `STATICFILES_DIRS` once it
exists. `backend/templates/index.html` is the real shell (guide section 8) since Fase 4. Two things
it depends on, both easy to undo by accident:

- **Vite hashes asset filenames by default**, and the shell asks `{% static %}` for
  `assets/index.css` and `assets/index.js`. The names are pinned in `rollupOptions.output` to match;
  WhiteNoise's manifest storage re-hashes them in production, so cache busting is not lost. If you
  unpin them, read `dist/.vite/manifest.json` from the template instead — never ship a shell
  pointing at names Vite is not emitting.
- **The shell view sets the CSRF cookie.** `clubi/urls.py` wraps the `TemplateView` in
  `ensure_csrf_cookie`; a visitor with a valid session but no `csrftoken` cookie would have every
  write rejected, since `client.ts` reads the header from it.

The `@font-face` and logo URLs in `base.css` are absolute `/static/…` paths, which Vite leaves
alone (it warns that they "didn't resolve at build time" — that is expected, Django owns them) and
which Django's manifest storage rewrites to the hashed names at `collectstatic`.

If a `fetch` ever returns this shell's HTML, the URL is wrong — the catch-all excludes `api/` on
purpose.
