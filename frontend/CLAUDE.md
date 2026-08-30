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

**Fases 4, 5, 6, 7 and 8 are done — every frontend phase the guide has.** Vite with the proxy,
`client.ts`, TanStack Query, `styles/tokens.css` and `base.css`, `Header`, `Footer`, `Home` with
the monthly highlight and a working `ProgressBar`, `Feed`, `NewPost`, `PostDetail` and `PostCard`,
`Profile`, `EditProfile`, `StarRating` and `FavoritesShelf`, `Search`, the header's `MemberSearch`
autocomplete and `PickHistory`, and the external-catalogue half of `BookPicker`. You open `/`,
see the book of the month, update your progress and rate it, ask who already finished it, read the
postagens, open any member's profile to see their shelf and every reading they have logged, find
a member by name or `@handle` from any screen, read back every book the club has ever picked, and
— when the acervo does not have the book you mean — find it in the Open Library and register it
without leaving the form you were filling in. **Writing a postagem is the organisation's** (see
below).

**One round of changes landed after Fase 8 and is not a phase**, so nothing in the guide names it.
It reshaped the Home and the postagens, and four of its decisions outlive it:

1. **"Quem está lendo" became "quem já terminou", and it is asked for rather than shown.**
   `ReadersList` is gone; `FinishedReaders` is a disclosure *inside* the reading card, whose query
   waits for the click (`enabled: open`). `GET /api/monthly-picks/current/readers` now returns only
   members with `finished_at` **and** a rating, alphabetically, as `{user, rating}` — `pages_read`,
   `percent` and `finished_at` left the contract with the screen that drew them. DESIGN.md 9 was
   amended for this, and says plainly which part of it is under tension.
2. **A rating of `0` is zero stars; `null` is "sem nota".** They used to be the same thing on both
   sides. See the note under "Response shapes" — this is the change most likely to be undone by
   accident.
3. **The Home is two blocks: the book, and your reading of it.** `RecentPosts` is deleted, so
   `["posts", 1]` has one caller again (`Feed`), and `/` no longer fetches the feed at all.
4. **"Publicação" is now "postagem" everywhere a member can read it**, identifiers untouched — the
   model is still `Post`, the route still `/posts`, the query key still `["posts", …]`.

What is here:

- [DESIGN.md](DESIGN.md) — the visual source of truth (ADR-17). E-01 … E-12 were reviewed by the
  founder on 2026-08-27; **E-13 (component dimensions, section 8.7) came out of Fase 4, grew three
  rows in Fase 5, four more in Fase 6 (profile photo, rating star, shelf slot, history cover), two
  more in Fase 7 (the header's search field, the member card) and one more in Fase 8 (the cover in
  an external result), and is the only one still open.**
- `clubi/` — the brand assets themselves: brandbook PDF, logo variants, the two font families,
  graphic elements, and the published social pieces. Read-only input to DESIGN.md; never edit
  these, and never derive a value from them without recording it in DESIGN.md.
- `src/` — the SPA. Every route in guide 7.4 is mounted (see the table below); `App.tsx` answers
  everything else with a pt-BR not-found screen, because Django's catch-all hands the shell every
  path it does not own.

Next up is the guide's **Fase 9** (deploy) — Render, Neon, R2 — the last phase, and the one that
still has backend work in it (`DATABASE_URL` is not in `settings.py` yet, ADR-13). Nothing in
`frontend/` is owed to it beyond `npm run build`.

> **The phase numbers used to disagree, and Fase 8 settled it.** Guide section 9 numbers the
> external-catalogue work **8** and the deploy **9**; this file and the root `.claude/CLAUDE.md`
> had them the other way round. The guide is the spec (see the top of this file), so its numbering
> won and both files were corrected. If you find an older note calling the deploy "Fase 8", that is
> the losing side of this — the deploy is **Fase 9**.

### The scope disagreement Fase 8 decided

Guide section 9 calls Fase 8 "integração com API de livros" and says what is missing is "o
autocomplete no cadastro de livro". **There is no cadastro de livro.** `POST /api/books`
(`create_book`) had no caller anywhere in the SPA, guide 7.4's route table has no screen for it,
and the picker that three screens already use searched the local acervo only. So the phase was not
"add autocomplete to an existing form" — it was "decide where a book gets registered, and write
that". Decided as follows, and written down rather than chosen in silence:

1. **The registration lives in `BookPicker`, not on a screen of its own.** The picker searches
   `GET /api/books?q=` as before; once the acervo comes up short the member can ask for
   `GET /api/books/external`, and choosing one of those hits `POST /api/books` and hands the saved
   `BookOut` to `onSelect`. That fixes `NewPost`, `PostDetail`'s inline edit and `FavoritesShelf`
   in one component, adds no route outside 7.4, and is literally what the endpoint map's own line
   for `POST /api/books` describes — "cadastra livro (manual ou vindo da API externa)".
2. **A `/books/new` screen was rejected.** It costs a route the documented table does not have,
   and it breaks the only flow that actually wants this: the member is halfway through writing a
   post, or filling a shelf slot, and needs a book that is not there yet. Sending them to another
   screen to come back is the interruption the picker exists to avoid.
3. **There is still no manual book form, and that is on purpose.** Everything a member can
   register comes from the external catalogue; a book the Open Library does not have is a job for
   the Admin, which is a shipped product (ADR-14). Writing a free-text book form would have been a
   second way to create the same row, with no validation the API does not already do and every
   chance of two spellings of one book.

Four things that decided how the external half behaves, all of them from the contract rather than
from taste:

- **It is opt-in, and it starts at three letters after a 600ms pause.** The local search keeps the
  shared 250ms default. The external one is a proxied third-party call the backend gives eight
  seconds (guide 6.7), so it is the only search in the SPA that can take seconds: at 250ms a normal
  typing rhythm queues several of those against the Open Library before the member finishes a
  title. `useDebouncedValue` is simply called a second time with a longer delay — one hook, two
  callers, no copy.
- **`ExternalBookOut` is not quite postable as-is, and `externalBook.ts` is where that is handled.**
  Guide 6.7 says it carries exactly `BookIn`'s fields, and it does — but the two disagree on
  *ranges*. `title` is capped at 200 and `author` at 140, and an over-long one is a 422 whose
  `detail` is a Pydantic array, which `client.ts` flattens to "Os dados enviados não foram
  aceitos." — a sentence that names neither the result nor the fix. So identity that does not fit
  **blocks** the row with a Portuguese reason (`externalBookProblem`), and metadata that does not
  fit is **dropped** (`bookPayload`): a negative `first_publish_year` from an ancient work fails
  `ge=0`, a `pages` of 0 fails `ge=1`, and `cover_url`/`external_id` are bounded by the *columns*
  (200 and 60) but not by `BookIn` at all — SQLite would swallow those and the Neon Postgres of
  ADR-13 would answer 500. Both functions are pure and live in `externalBook.test.ts`.
- **`create_book` is idempotent on `(title, author)`, so the same book twice is not an error — but
  the second time you get the row that already existed.** `get_or_create`'s `defaults` only apply
  on creation, so a book someone registered before, with no cover, comes back without one even if
  the Open Library now has one. That is the API's behaviour and the picker does not paper over it:
  what reaches `onSelect` is always the saved `BookOut`, never the catalogue hit.
- **A 502 has to leave the field usable.** The Open Library failing is a 502 with a pt-BR `detail`,
  never a 500, and `retry: false` means it lands on the first try. It renders as a notice carrying
  that `detail` plus where to go next, and the local search above it keeps working — verified by
  driving it with the backend pointed at an unreachable host.

One thing Fase 8 changed in a file Fase 4 had already written:

- **`BookCover` falls back to its own placeholder when the image fails to load, and is built out of
  phrasing content.** A cover from `covers.openlibrary.org` is a third party that can 404, be
  blocked or be slow (it redirects through `archive.org`, which takes seconds), and without
  `onError` the frame held the browser's broken-image glyph — neither the brand's stroke nor a
  word (DESIGN.md 6.3). It remembers the URL that failed rather than a bare boolean, so a new cover
  on the same component still gets its chance. The `<div>`/`<p>` became `<span>`s for the same
  feature: the cover sits inside the result `<button>`, and a `<div>` there is not valid content.
  Its prop narrowed from `Book` to the three fields it reads, which is what lets it draw a
  catalogue hit that is not a row in the database yet.

### The scope disagreement Fase 7 decided

The documents did not agree on what Fase 7 contains. Guide section 9 says the phase is "a tela
`Search` e o autocomplete no `Header`"; guide 7.4's route table and this file's own layout tree
listed **three** unwritten screens — `BookOfTheMonth`, `PickHistory` and `Search`. Decided by what
already existed on screen, and written down rather than chosen in silence:

1. **`Search` and the header autocomplete are Fase 7 proper**, over `search_users`
   (`GET /api/users`, with `q` and `limit`).
2. **`PickHistory` was written too — as balance owed from Fases 4–6, not as Fase 7 scope.**
   `GET /api/monthly-picks` had no caller at all: the Home shows the *current* pick and a profile
   shows *your* readings, so the club's own list of choices had no page anywhere. DESIGN.md 6.3
   had already assigned it the `livro-fechado` element, which is a document expecting the screen.
   It reuses `BookCover`, `formatMonth` and the profile's `.history` row, so it cost one route
   file and no new machinery.
3. **`BookOfTheMonth` was *not* written, and `/book-of-the-month` redirects to `/`.** The Home
   already **is** that screen: guide 7.4 defines it as "destaque do mês + posts recentes", and it
   renders `MonthlyPickHighlight` and `ProgressBar` over the same pick, blurb and synopsis
   included. (7.4's "posts recentes" half is gone — see the round of changes at the top of this
   file — which strengthens the case rather than weakening it: `/` is now *only* the book.) A second screen would have been the near-copy 7.4 warns about two lines
   below its own route table — and it would have been a URL with nothing of its own to say. The
   redirect keeps the documented address alive and gives `/book-of-the-month/history` a parent
   that resolves instead of 404-ing. **Write the real screen the day the Home turns into a mixed
   landing page**; then the deep page has content the Home no longer carries.

One more decision, about the field rather than the screens: **there is one search box, not two.**
`MemberSearch` lives in the `Header`, so search is reachable from everywhere, and on `/search` it
binds straight to `?q=` — the screen has no field of its own. State rule 1 wants the term in the
URL, and a screen-level `useState` mirroring the header is exactly the duplicate that breaks F5,
the back button and a shared link. Off `/search` the same field is a draft with no screen behind
it yet, which becomes URL state the moment it is submitted; that is also why the suggestions panel
is suppressed on `/search`, where the results list already does its job. The `type="search"` input
keeps the browser's own clear button: that is user-agent chrome, not an icon this project drew
(DESIGN.md 6.3 governs what we author, and E-07 is honoured — the control is the word in the
placeholder, "Buscar membros", and there is no magnifier anywhere).

Two behaviours worth keeping if this component is ever rewritten, because both were found by
driving it rather than by reading it:

- **`@ana` and `ana` have to find the same person.** Every profile prints the handle with the `@`,
  but `search_users` matches `username__icontains` against the stored value, which has none —
  `searchTerm()` strips it before the request.
- **Escape has to close the panel from inside it.** With the key handler on the input, Escape
  stopped working the moment ArrowDown moved focus into a suggestion; it is on the wrapper. And
  the field opens the panel on `onClick`, not `onFocus`, because Escape hands focus back to the
  field and an `onFocus` would immediately reopen what the member just dismissed.

Four things Fase 7 changed in files Fases 4–6 had already written:

- **The avatar ternary is now `MemberAvatar`.** `PostCard`, `PostDetail` and the old `ReadersList`
  each had their own copy of "photo, or initials in a `.avatar`" before the search needed it twice
  more. Same reasoning that moved `initials()` into `format.ts` in Fase 5.
- **`BookPicker`'s debounce is now `useDebouncedValue`** (`src/useDebouncedValue.ts`), shared with
  `MemberSearch` and `Search`. Three copies of the same `useEffect` was the alternative.
- **`.feed__title` is now `.page-title`.** `Feed`, `Search` and `PickHistory` head their screens
  the same way; one class, so the three cannot drift. `.feed__heading` (the row with "Postar")
  is still feed-specific.
- **The header wraps and is a stacking context.** `.site-header__inner` gained `flex-wrap`, and at
  phone width the search field takes its own row under the logotype (DESIGN.md 8.5: the member
  arrives by phone). `.site-header` gained `position: relative; z-index: 30` so the suggestions
  paint over the page instead of behind the first card below them. `MonthlyPickHighlight` and the
  Home's "ainda não há livro do mês" state also gained the link into `PickHistory` — a screen
  nothing links to is a screen nobody finds.

### Three places the API and the documents disagree, decided in Fase 6

Each of these was a real conflict, and the resolution is deliberate rather than an oversight:

1. **There is no list of a member's posts on their profile**, although guide 7.4 and the route
   table below both used to promise `PostCard` on three screens. `GET /api/posts` accepts only
   `page` and `size` — there is no author filter — so the section could only be built by filtering
   a paginated feed on the client, which shows "their posts that happened to land on page 1". Both
   documents were corrected instead of shipping that. **Adding the section means adding an
   `author` query param to `list_posts` first.**
2. ~~**A rating of `0` means "sem nota", and is the only way to clear one.**~~ **Superseded.** It
   was true, and it was a workaround for an API that had no way to say "erase": `update_reading`
   guards every field with `if payload.<field> is not None`, so `{"rating": null}` is discarded in
   silence. It stopped being tenable when "quem já terminou" started filtering on
   `rating_halves IS NOT NULL` — a member who had erased their note would have appeared on the
   list captioned "sem nota". So the backend grew `MonthlyReadingIn.clear_rating`, and `0` became
   the zero-star rating it always looked like. The reversibility DESIGN.md 9 asks for now comes
   from the erase field, not from the 0.
3. **`PatchDict` drops `ProfileIn`'s `max_length`.** A 200-character `full_name` (column: 120) and
   a 200-character `quote` (column: 180) both answer 200 OK and are written — SQLite does not
   enforce varchar length, but the Neon Postgres of ADR-13 would raise `DataError` → 500. So the
   `maxLength` attributes in `EditProfile` are not a convenience, they are **the only length
   validation in the path today**. Fixing the backend is a decision to raise, not something to
   change inside a phase declared frontend-only.

One thing Fase 6 changed in a file Fase 4 had already written:

- **`client.ts` normalises a non-string `detail`.** Ninja's own 4xx bodies are
  `{ "detail": "..." }` in pt-BR and are still carried through untouched, but Pydantic's 422 sends
  an *array* of validation objects whose `msg` is English and mentions `loc`/`ctx`. That coerced
  to the literal `"[object Object]"` on screen. The screens make a 422 unreachable — the shelf
  locks at four slots and generates its own positions — so this is the guard behind the guard.

Two things Fase 5 changed in files Fase 4 had already written, worth knowing before assuming
those files are frozen:

- **`client.ts` learned to handle a 204.** `DELETE /api/posts/{id}` answers with no body;
  `response.json()` on that throws, so a successful delete used to report as a failed mutation.
  It also widened its `headers` param to accept `{ "Content-Type": undefined }`, which it turns
  into an actual `Headers.delete()` — the only way a `FormData` upload gets the browser to write
  its own multipart boundary instead of shipping the default `application/json`.
- **The reader avatar's CSS class is `.avatar`, not `.reader__avatar`.** `PostCard` and
  `PostDetail` reuse it for the post author. `ReadersList.tsx` — deleted since — was updated to
  match, and the `initials()` helper it used to define locally moved to `format.ts`; that is why
  the class outlived the component it was named after.

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
npm test                   # vitest, once — the pure logic beside a component (starRating.ts)
npm run build              # emits frontend/dist, which Django picks up as a staticfiles dir
npx tsc --noEmit           # the contract guard (ADR-12) — run after touching API types
```

**Node 20.19+ is a hard floor**, and the failures do not say so. Vite 8 bundles rolldown, whose
ESM entry imports `styleText` from `node:util` — on Node 18 both `npm run dev` and `npm run build`
die with `SyntaxError: ... does not provide an export named 'styleText'`, which reads like a
corrupt install. `chrome-devtools-mcp` refuses Node 18 outright, so the MCP server of ADR-16 shows
up as a connection failure rather than a version error. `npx tsc --noEmit` is the one command that
still runs on 18. Also install with the same Node you develop on: an `npm install` under npm 9
rewrites `package-lock.json` (it drops the `libc` fields) and skips the platform-native rolldown
binary, and the build then reports `Cannot find native binding`.

`make types` is the only supported way to regenerate `src/api/generated.ts`:

```makefile
types:
	cd backend && uv run manage.py export_openapi_schema --output ../openapi.json
	cd frontend && npx openapi-typescript ../openapi.json -o src/api/generated.ts
```

## Stack

React, TypeScript, Vite, React Router, TanStack Query, and plain CSS. That is the whole list.
Vitest is the one dev-only addition — it came in with the half-star rating, whose position-to-value
arithmetic is the first thing here worth testing without a browser, and Fase 8 gave it a second
subject in `externalBook.ts`. It reads `vite.config.ts`, so
it has no config of its own, and it does not render components: there is no jsdom and no Testing
Library, and adding either is a decision to raise. Pure logic goes in a `.ts` beside the component
and gets a `.test.ts`; behaviour that needs a real browser is driven through the DevTools MCP below.

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

Fase 5 taught it two things the guide's snippet doesn't cover, both needed by posts: a 204 (from
`DELETE /api/posts/{id}`) returns `undefined` instead of calling `.json()` on an empty body, and
`init.headers` accepts `{ "Content-Type": undefined }` to let a `FormData` upload remove the
default JSON header so the browser can write its own multipart boundary. Both are additive — no
existing caller needed to change.

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
    ├── useDebouncedValue.ts      # one value, one request per pause — the searches and both
    │                             # halves of BookPicker, which calls it twice at two delays
    ├── unreadPosts.ts            # the unread count and the "I have read them" mutation,
    │                             # shared by the header badge and UnreadNotice
    ├── assets/    elements/ (10 svg, currentColor). Fonts and the logo live in
    │              backend/core/static/brand/ — one copy, both surfaces (DESIGN.md 2.1)
    ├── api/       client.ts, generated.ts, types.ts
    ├── context/   CurrentUser.tsx
    ├── routes/    Home, Feed, NewPost, PostDetail, Profile, EditProfile,
    │              PickHistory, Search
    ├── components/ Header, Footer, PostCard, MonthlyPickHighlight,
    │              ProgressBar, StarRating (+ starRating.ts, its pure
    │              position-to-value logic, tested in starRating.test.ts),
    │              FavoritesShelf, BookCover,
    │              BrandElement, FinishedReaders, UnreadNotice,
    │              BookPicker (+ externalBook.ts, the pure hit-to-BookIn
    │              mapping, tested in externalBook.test.ts),
    │              MemberSearch, MemberAvatar
    └── styles/    tokens.css, base.css
```

Everything above is written. **`BookOfTheMonth.tsx` is not in the tree on purpose** — see the
Fase 7 decision above; `/book-of-the-month` redirects to the Home, which is that screen.

Six components are not in guide 7.4: `BrandElement` (inlines a brand SVG so `currentColor`
applies), `FinishedReaders` (the folded "quem já terminou" panel inside the reading card),
`UnreadNotice` (the one-line greeting for a member arriving with postagens waiting),
`BookPicker` — the search-select behind `PostIn.book_id`, written for `NewPost`, reused by
`PostDetail`'s inline edit and, since Fase 6, by `FavoritesShelf` (its input `id` is a prop with a
default: two pickers on one screen would otherwise share an `id` and the second `<label htmlFor>`
would address the first field), and since Fase 8 **the only place in the SPA that creates a book**
— and, from Fase 7, `MemberSearch` (the header's field, which also exports `searchTerm()` and the
`useMemberSearch()` query that `Search` reuses) and `MemberAvatar`.

| Route | Component | | Route | Component |
|---|---|---|---|---|
| `/` | `Home` | | `/profile/edit` | `EditProfile` |
| `/posts` | `Feed` | | `/book-of-the-month` | → redirects to `/` |
| `/posts/new` | `NewPost` | | `/book-of-the-month/history` | `PickHistory` |
| `/posts/:id` | `PostDetail` | | `/search` | `Search` |
| `/u/:username` | `Profile` | | | |

`PostCard` renders on the Feed and nowhere else — **one screen, not the three guide 7.4
predicted**. Profile is not a caller because `GET /api/posts` has no author filter (see the first
of the three disagreements above); the Home stopped being one when `RecentPosts` was deleted.

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
| Who already finished | `["readers", "current"]` | saving progress **and saving or erasing a rating** — a rating is now half of what puts a member on that list |
| Feed | `["posts", page]` | creating, editing or deleting a post |
| Unread postagens | `["posts", "unread"]` | `POST /posts/seen` (`setQueryData`, not an invalidation — the response *is* the new count) |
| Single post | `["post", id]` | editing that post (`setQueryData` on the mutation response; deleted on a successful delete) |
| Book search (NewPost, edit) | `["books", "search", query]` | never — read-only, and `staleTime` alone keeps retyping the same term cheap |
| Profile | `["user", username]` | editing the profile, saving favorites, saving a rating (the history prints it) |
| Current user | `["me"]` | editing the profile, **and saving favorites** — `UserOut` embeds `favorites`, so the `/api/me` behind `CurrentUserProvider` goes stale too |
| Member search (header, `/search`) | `["users", "search", term, limit]` | never — read-only, like the book search |
| Every pick the club made | `["monthly-picks"]` | never — picks are elected in the Admin (ADR-14), not from the SPA |
| External catalogue (`BookPicker`) | `["books", "external", term, limit]` | never — read-only, and see the note below about *not* invalidating it |

**Invalidate `["books", "search"]` after `POST /api/books`, not `["books"]`.** The acervo gained a
row, so every local search entry may be missing it — but the `["books"]` prefix also covers
`["books", "external", …]`, and refetching that means a second round trip to the Open Library, up
to eight seconds long, for a list the member has already chosen from and is about to leave. It is
the one place in this table where the shorter prefix is the wrong answer.

**`limit` is in the search key because it is in the request:** the header asks for five results
and `/search` for fifty, and one key for both would hand the screen the header's five. The term in
the key is the debounced, `@`-stripped one, so `@ana` and `ana` share a cache entry.

**`["posts", 1]` has exactly one caller now.** It used to be shared with `RecentPosts` on the Home,
which is deleted — so the Home fetches no postagens at all any more, and nothing on `/` depends on
the feed. Invalidation after a write still uses the `["posts"]` prefix, which covers every page of
the feed at once (and `["posts", "unread"]` with it, harmlessly); do not invalidate a single
`["posts", page]` tuple, since the write may have changed which page an item belongs on.

**`["readers", "current"]` is fetched lazily.** `FinishedReaders` passes `enabled: open`, so
nothing is requested until the member opens the panel. The invalidations above still fire whether
it is open or not — TanStack marks a disabled query stale without fetching it, which is the
behaviour that makes this safe: open the panel later and it refetches once.

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
- **`rating` is 0 to 5 in steps of 0.5**, and `multiple_of=0.5` on the schema means a 3.3 or a 5.3
  is a 422, not a rounded write. The column behind it stores half-stars as an integer (a 3.5 is a
  7 in `rating_halves`); that is undone by a property on the model, so the wire never carries it
  and nothing on this side should double or halve anything. `starRating.ts` is where the 0.5 grid
  lives on the client.
- **`0` is a rating and `null` is the absence of one, and erasing is `{"clear_rating": true}`.**
  Until "quem já terminou" needed to tell the two apart, `{"rating": 0}` was the only erasure the
  API offered and the SPA printed both as "sem nota". Now: `ratingCaption(0)` is "0 de 5" and only
  `ratingCaption(null)` is "sem nota"; dragging off the left end of the bar and pressing Home both
  give a deliberate zero; **"Tirar a nota" is the only path back to `null`**, so it shows for a 0
  as much as for a 5. A `{"rating": null}` still means "leave it alone" — that is what makes the
  `PUT` partial, and it is why erasing needed a field of its own rather than a null.
- **`GET /api/me` carries `is_staff`; no other response does.** It is `MeOut`, a subclass of
  `UserOut` that exists so the flag stays off `UserProfileOut` (which extends `UserOut` too) and
  out of `UserBrief`, where it would have become project-wide vocabulary (ADR-15, rule 3). The TS
  type is `Me`, not `User`.
- **Only `is_staff` may write a postagem.** `create_post`, `update_post`, `delete_post` and
  `attach_image` answer everyone else with 403 and a pt-BR `detail`. The SPA hides the shortcuts
  and sends `/posts/new` back to `/posts`, but that is courtesy — the backend is the authority,
  and it refuses regardless of what is drawn.
- **Unread is one stamp, not a row per post.** `User.posts_seen_at` versus `Post.created_at`;
  `GET /api/posts/unread` counts, `POST /api/posts/seen` stamps, and your own postagens never
  count. A member who has never opened the feed has everything unread, which is what every member
  gets the day it ships and what one visit to `/posts` settles.
- **The shelf is replaced whole**: `PUT /api/me/favorites` with positions 1–4. Reorder in local
  state, then PUT. `UserOut.favorites` comes back as a bare `BookOut[]` already in slot order — no
  `position` on the way out — so the order *is* the array index, and saving rebuilds `position` as
  index + 1. Always send contiguous 1..N: the API accepts 1 and 4, but on read that is
  indistinguishable from 1 and 2, so a gap is invisible dirt.
- **`BookOut.id` is `number | null | undefined`** in the generated types, because `ModelSchema`
  derives it from Django's AutoField. Everything the API returns is saved, so narrow once at the
  boundary (`FavoritesShelf` does) rather than asserting at each use.
- **`GET /api/books/external` is the only authenticated *read* in the SPA, and the only slow one.**
  `q` is required and an empty one is a 400; `limit` defaults to 10 and is clamped to 1–20; any
  failure of the Open Library is a **502** with a pt-BR `detail` ("A busca externa de livros está
  indisponível."), never a 500, and the backend caps the call at 8 seconds. A loading state is not
  optional here.
- **`POST /api/books` is idempotent on `(title, author)`** via `get_or_create`, so registering the
  same book twice does not trip the unique constraint — but the `defaults` apply on creation only.
  A book that already existed comes back with the data it already had, not with the Open Library's.
- **`GET /api/users` with an empty `q` returns the whole club**, active members only, ordered by
  `full_name` (`User.Meta.ordering`) — which is why `/search` with no term lists everyone instead
  of sitting empty, and why nothing in that list is ordered by activity. `limit` is clamped to
  50 server-side, so asking for more silently gets 50.
- **On `PATCH`, clear a text field with `""`, not `null`** — only `birth_date` and `Post.book_id`
  accept `null`.
- **Uploads are multipart**: `PUT /api/me/photo` (max 8 MB) and `POST /api/posts/{id}/images`
  (max 4), both field `file`. A post with images is two requests. `client.ts` hardcodes
  `Content-Type: application/json`, so a `FormData` body must override that header away and let the
  browser set the boundary. **There is no endpoint to remove a photo** — `upload_photo` only
  writes and `ProfileIn` has no `photo` field — so do not draw a "Remover foto" button.
- **An emptied `<input type="date">` must be sent as `null`, never `""`.** `date | None` does not
  parse an empty string, and `update_me` converts a null to `""` for every field *except*
  `birth_date`, the one genuinely nullable column. That is the opposite of `update_post`, which
  ignores a null in `title`/`body` and accepts it only in `book_id`.

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
  `balao` is the way to the postagens. Where it is a control, use a word: "Postar", "Ver mais",
  "Excluir", and a search field with a placeholder rather than a magnifier. The header's postagens
  link is the one place both apply at once, and it does both — balão *and* the word, never a mute
  icon (DESIGN.md 6.3, registered as E-14). Do not install Lucide, Feather or Heroicons — that is a
  deviation to raise, not a default.
- **The tone is anti-metric and it is load-bearing** (DESIGN.md section 9). No ranking, no streaks,
  no "you're behind", no red for low progress. `ProgressBar` and `StarRating` are the two
  components most likely to get this wrong — and `FinishedReaders` is the one that lives closest to
  the line, since a list of members' ratings *is* comparable. What keeps it on the right side is
  written into DESIGN.md 9: alphabetical order, no average, no count, and folded away until the
  member asks. Do not "improve" it with a club average or a sort by rating.

**`StarRating` carries a `number | null`, and the two are different answers.** Its internal
"pending" state is a *box* (`{ rating } | null`) rather than a bare value, because `null` became a
rating state and could no longer double as "nothing in flight". `aria-valuenow` still falls back to
0 for an unrated row — a slider must carry a number — which is exactly why `aria-valuetext` is not
optional on this widget.

**`StarRating` is a `role="slider"`, not a radio group.** Half stars would have needed ten inputs,
and a radio ring cannot show a value the member has not committed to — the preview under the
cursor is the whole point of dragging. What the radios used to give for free is now explicit and
must stay: arrow keys (±0.5), PageUp/PageDown (±1), Home/End, `aria-valuenow`/`aria-valuetext`,
and a focus ring on the bar itself. The value is read off the bar's own rectangle rather than from
one element per half, so the row is continuous — **the left half of a star fills *that* star
halfway, it does not complete the one before it**, which is what keeps the drawing under the
finger. `touch-action: pan-y` is load-bearing on touch: without it a drag scrolls the page.

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
