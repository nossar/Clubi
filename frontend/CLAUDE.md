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

**No code here yet.** What exists is documentation and assets:

- [DESIGN.md](DESIGN.md) — the visual source of truth (ADR-17). Written; extrapolations in its
  section 12 are still pending the founder's review.
- `clubi/` — the brand assets themselves: brandbook PDF, logo variants, the two font families,
  graphic elements, and the published social pieces. Read-only input to DESIGN.md; never edit
  these, and never derive a value from them without recording it in DESIGN.md.

This file and DESIGN.md are the contract the code will be held to. The backend is finished and the
club already runs on `/admin/` (ADR-14), so nothing here blocks the club.

Next up is the guide's **Fase 4**: Vite with proxy, `client.ts`, TanStack Query, CSS tokens,
`Header`, `Footer`, and `Home` with the monthly highlight and a working `ProgressBar`. Done when
you open `/`, see the book of the month, and update your progress through the UI. Follow the phase
order rather than building screens out of sequence.

The asset prep that used to gate this is **done**, and so is the `auth.css` realignment — the
rendered `/accounts/` pages already run on the brand tokens, so the tokens are proven in a browser
before the SPA exists. Copy them from DESIGN.md section 11; `auth.css` is the working reference.

Two things there that will bite otherwise. Clash Semibold declares itself as family `"Clash Display
Semibold"`, so `@font-face` must rename it to `"Clash Display"` weight 600 or `font-weight`
silently stops working. And **`vite.config.ts` must proxy `/static` too**, alongside `/api`,
`/admin`, `/accounts` and `/media` — fonts and the logo are served by Django from
`/static/brand/` (DESIGN.md 2.1), and without the proxy the dev server renders in system fonts with
no error to tell you why.

Every string the SPA renders is user-facing, so it is pt-BR — labels, buttons, empty states, error
copy, `aria-label`, and `Intl` formatting for dates and numbers. Identifiers stay English.

## Commands

Nothing is scaffolded yet; these are the commands as they will exist. Run them from `frontend/`.

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
the whole login flow (ADR-05) — the SPA has no `/login` route, and logout is a link, not a fetch.

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
    ├── assets/    elements/ (10 svg, currentColor). Fonts and the logo live in
    │              backend/core/static/brand/ — one copy, both surfaces (DESIGN.md 2.1)
    ├── api/       client.ts, generated.ts, types.ts
    ├── context/   CurrentUser.tsx
    ├── routes/    Home, Feed, NewPost, PostDetail, Profile, EditProfile,
    │              BookOfTheMonth, PickHistory, Search
    ├── components/ Header, Footer, PostCard, MonthlyPickHighlight,
    │              ProgressBar, StarRating, FavoritesShelf, BookCover
    └── styles/    tokens.css, base.css
```

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

`main.tsx` defaults: `staleTime: 30_000`, `refetchOnWindowFocus: false`.

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

**`auth.css` currently disagrees with DESIGN.md.** It shipped with an improvised palette
(`#f6f2ea`, `#7a2e2e`, Inter) that predates anyone reading the brandbook. Realigning it to the
brand tokens is a **prerequisite of the first SPA CSS commit**, not later cleanup (ADR-17): while
the two files disagree, the seam ADR-05 promised to hide is visible on every member's first login.

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
exists. `backend/templates/index.html` is a placeholder and gets replaced by the real shell (guide
section 8) as part of the first frontend slice. Two things to get right when that lands:

- **Vite hashes asset filenames**, but the guide's shell hardcodes `assets/index.css` and
  `assets/index.js`. Either pin the names in `rollupOptions.output` or read
  `dist/.vite/manifest.json` from the template. Do not ship a shell pointing at names Vite is not
  emitting.
- **The shell view must set the CSRF cookie.** `clubi/urls.py` serves it with a bare
  `TemplateView`; a visitor with a valid session but no `csrftoken` cookie has every write
  rejected. Wrap it in `ensure_csrf_cookie`, or keep a `{% csrf_token %}` in the template.

If a `fetch` ever returns this shell's HTML, the URL is wrong — the catch-all excludes `api/` on
purpose.
