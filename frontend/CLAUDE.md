# CLAUDE.md — frontend

The root `.claude/CLAUDE.md` is authoritative for everything project-wide; this file adds only what
is specific to `frontend/`. Section 7 of `clubi-guia-de-implementacao.md` is the folder's spec.
**[DESIGN.md](DESIGN.md) is mandatory reading before any CSS or component work (ADR-17)** — a
colour, font, size, radius, shadow or tone invented in a component is a process bug.

## Commands

Run from `frontend/`, or use the root `Makefile`.

```bash
npm install            # npm ci in CI/deploy
npm run dev            # Vite on :5173 — needs manage.py runserver on :8000
npm test               # vitest run: pure logic only (ratingScale.ts, externalBook.ts)
npm run build          # emits dist/, which settings.py adds to STATICFILES_DIRS
npm run typecheck      # tsc --noEmit — the ADR-12 guard, run after any schema change
make types             # regenerate src/api/generated.ts — the only supported way
```

- **Point the browser at `:5173`, never `:8000`** — that is the pair that exercises the proxy
  (ADR-16a). Chrome DevTools MCP is configured in `.mcp.json`; local only, never `/admin/`.
- **`/` is deliberately not proxied** — the ADR-18 landing is only visible on `:8000`.
- **Node 20.19+ is a hard floor and the failure does not say so.** Vite 8's rolldown entry imports
  `styleText` from `node:util`, so Node 18 kills `dev` and `build` with a `SyntaxError` that reads
  like a corrupt install. Install with the same Node you develop on: npm 9 rewrites
  `package-lock.json` and skips the native binary → `Cannot find native binding`.

## src/

```
main.tsx            QueryClient defaults + router mount
App.tsx             routes; unmatched paths render a pt-BR not-found screen
api/                client.ts (the only fetch), generated.ts (generated), types.ts
context/            CurrentUser.tsx — useCurrentUser() is a context read, not a fetch
routes/             Home, Feed, NewPost, PostDetail, Profile, EditProfile, PickHistory, Search
components/         Header, AccountMenu, Footer, MonthlyPickHighlight, ProgressBar, BookCover,
                    FinishedReaders, UnreadNotice, PostCard, PostEditForm, PostImages, MemberSearch,
                    MemberAvatar, BrandElement, FavoritesShelf, StarRating (+ratingScale.ts),
                    BookPicker (+externalBook.ts)
styles/             tokens.css, base.css
format.ts           pt-BR Intl helpers + initials()
posts.ts            canManagePost, useDeletePost, useUpdatePost, postEditPayload
unreadPosts.ts      useUnreadPosts, useMarkPostsSeen
useDebouncedValue.ts
```

There is no `assets/` dir: brand SVGs live in `backend/core/static/brand/elements/` and
`BrandElement` inlines them with `?raw` across that path — one copy, both surfaces (DESIGN.md 2.1).

| Route | Component | | Route | Component |
|---|---|---|---|---|
| `/` | `Home` | | `/profile/edit` | `EditProfile` |
| `/posts` | `Feed` | | `/book-of-the-month` | → `/` (the Home *is* that screen) |
| `/posts/new` | `NewPost` | | `/book-of-the-month/history` | `PickHistory` |
| `/posts/:id` | `PostDetail` | | `/search` | `Search` |
| `/u/:username` | `Profile` | | | |

## To do X, edit Y

| X | Y |
|---|---|
| Add or change an endpoint's fields | backend schema → `make types` → `api/types.ts` |
| Change how a postagem is edited or deleted | `posts.ts` — `PostCard` and `PostDetail` share it |
| Change how a postagem shows its photos | `PostImages` — both hosts share it |
| Register or search a book | `BookPicker`, the only place the SPA creates a book |
| Change the rating maths or its captions | `ratingScale.ts` (+ its `.test.ts`) |
| Change a colour, size or spacing | DESIGN.md first, then `styles/tokens.css` |

## Network and data

- **`src/api/client.ts` is the only file that calls `fetch`.** It prefixes `/api`, sends
  `credentials: "same-origin"`, attaches `X-CSRFToken` from the cookie, redirects to
  `/accounts/login/?next=…` on 401 and throws `ApiError(status, detail)` otherwise. Components go
  through TanStack Query; never `fetch`, `axios` or an absolute URL (ADR-16c, ADR-05).
- **Path and method are string literals and `tsc` does not check them.** A wrong route shows up as
  a 404 on the first render, never at build time. If a response ever comes back as the shell's
  HTML, the path is wrong — the catch-all excludes `api/`.
- **There are no auth screens in the SPA** (ADR-05). The 401 redirect *is* the login flow. Logout
  is not a fetch either: `AccountMenu` posts a plain HTML form to `/accounts/logout/` with
  `csrfmiddlewaretoken` from the same cookie, because `LogoutView` refuses GET.
- **`src/api/generated.ts` is generated and never edited by hand** (ADR-12), not even to fix a
  type. `api/types.ts` is the thin hand-written alias layer over it.
- **Uploads are multipart and must remove the JSON header.** Pass
  `headers: { "Content-Type": undefined }` — `client.ts` turns that into a real `Headers.delete()`
  so the browser writes its own boundary. A plain spread keeps the key and ships `"undefined"`.

### Response shapes that decide component design

`/api/docs` has the full contract; these are the ones that change how a component is built.

- **The feed is a `Page`** — `{ items, total, page, has_next }`, params `page` and `size`.
  Paginate off `has_next`. `GET /api/posts` has **no author filter**, so a profile cannot list a
  member's postagens without adding one to `list_posts` first — do not filter page 1 on the client.
- **Errors are `{ "detail": "..." }` already in pt-BR.** Render `detail`; do not invent a message.
- **Images are URL strings, never objects** — `cover_image` is `""` when absent, `photo` is
  `string | null`, `PostOut.images` is a `string[]` of at most 4.
- **`GET /api/monthly-picks/current` 404s when no pick is set** — that is a state, not an error.
- **`BookOut.id` is `number | null | undefined`** in the generated types (`ModelSchema` over an
  AutoField). Narrow once at the boundary rather than asserting at each use.
- **Erasing a rating is `{"clear_rating": true}`; `{"rating": null}` means "leave it alone"** (it is
  what makes the `PUT` partial). `0` is a real rating, so "Remover nota" shows for a 0 as much as
  for a 5, and only `ratingCaption(null)` is "sem nota".
- **`GET /api/me` is the only response carrying `is_staff`** — its TS type is `Me`, not `User`.
  Hiding the "Postar" shortcuts is courtesy; the backend refuses regardless of what is drawn.
- **The shelf is replaced whole** — `PUT /api/me/favorites`, positions rebuilt as index + 1.
  Always send contiguous 1..N: the API accepts 1 and 4, but on read a gap is invisible.
- **`GET /api/books/external` is the only slow call in the SPA.** Opt-in, from three letters, on a
  600ms debounce (`useDebouncedValue` called a second time; the local search keeps the 250ms
  default). Any Open Library failure is a **502** with a pt-BR `detail`, never a 500, and the
  backend caps it at 8s — a loading state is not optional and the local search must survive it.
  `externalBook.ts` holds the pure mapping: over-long identity **blocks** the row with a Portuguese
  reason, out-of-range metadata is **dropped** (`BookIn` does not bound `cover_url`/`external_id`,
  but the columns do).
- **`POST /api/books` is idempotent on `(title, author)`**, but `get_or_create`'s `defaults` apply
  on creation only — an existing book comes back with the data it had, not the catalogue's.
- **`GET /api/users` with an empty `q` returns the whole club**, ordered by `full_name`; `limit` is
  clamped to 50 server-side. That is why `/search` with no term lists everyone.
- **On `PATCH`, clear a text field with `""`, never `null`** — only `birth_date` and `Post.book_id`
  accept `null`, so an emptied `<input type="date">` is sent as `null`. `update_post` is the
  opposite: an untouched field must be **absent** (`postEditPayload`), and an empty payload means
  close the form without a request.
- **There is no endpoint to remove a photo** — do not draw a "Remover foto" button.

## State

Three disciplines Django used to enforce for free (guide 7.5):

1. **Anything derivable from the URL lives in the URL** — page, term and filters via
   `useSearchParams`, never `useState`. There is one search box: `MemberSearch` in the `Header`,
   which on `/search` binds straight to `?q=` — that screen has no field of its own.
2. **The top component fetches.** Children take props. Ten `PostCard`s are one request.
3. **Cache with explicit invalidation.** `queryKey` mirrors the API route; after a write,
   invalidate *every* key that displays the affected data. The table below is maintained by hand.

| Data | `queryKey` | Invalidate after |
|---|---|---|
| Book of the month | `["monthly-pick", "current"]` | (practically never) |
| My reading | `["reading", "current"]` | saving progress or a rating |
| Who already finished | `["readers", "current"]` | saving progress, **and saving or erasing a rating** |
| Feed | `["posts", page]` | creating, editing or deleting a postagem |
| Unread | `["posts", "unread"]` | `POST /posts/seen` — `setQueryData`, the response *is* the count |
| Single post | `["post", id]` | editing it (`setQueryData`); `removeQueries` on a delete |
| Book search | `["books", "search", query]` | `POST /api/books` (see below) |
| External catalogue | `["books", "external", term, limit]` | never — read-only |
| Profile | `["user", username]` | editing the profile, saving favorites, saving a rating |
| Current user | `["me"]` | editing the profile, **and saving favorites** (`UserOut` embeds them) |
| Member search | `["users", "search", term, limit]` | never — read-only |
| Every pick | `["monthly-picks"]` | never — picks are elected in the Admin (ADR-14) |

- **After `POST /api/books`, invalidate `["books", "search"]` and not `["books"]`.** The shorter
  prefix also sweeps `["books", "external", …]`, costing a second eight-second round trip.
- **Invalidate the `["posts"]` prefix after a write**, never a single `["posts", page]` tuple — a
  write may change which page an item belongs on. It covers the unread key harmlessly.
- **`limit` belongs in a search key because it is in the request** — the header asks for five and
  `/search` for fifty. The term in it is the debounced, `@`-stripped one (`searchTerm()`).
- **`["readers", "current"]` is lazy** — `FinishedReaders` passes `enabled: open`. The
  invalidations above still fire while it is disabled; it refetches once when opened.
- `main.tsx` sets `staleTime: 30_000`, `refetchOnWindowFocus: false` and **`retry: false`** — this
  API's non-200s are states, not blips, and a 401 is already navigating away.

## Styling

- **`styles/tokens.css` and `backend/core/static/css/tokens.css` are twins** — same names, same
  values. Changing a token means changing both, and DESIGN.md before either (ADR-18).
  `--paper-grain` and `--tilt` stay out of both: they live in `base.css` and `landing.css`.
- **Body text is wine on cream or cream on wine.** Orange and yellow are measured to fail as body
  text; yellow only ever sits on wine.
- **Collage lives in the frame, not the machinery.** Hero, empty states and footer carry texture
  and rotation; forms, the feed, `ProgressBar` and lists stay clean and aligned.
- **There is no icon library and there will not be one** (DESIGN.md 6.3). Where an icon means
  something, use a brand element (`estrela-5`, `clips`, `balao`); where it is a control, use the
  word — "Editar", "Excluir", "Postar". Three hand-drawn glyphs carry a *job* each (`×` closes, the
  arrows move); a fourth is a DESIGN.md decision. Do not install Lucide, Feather or Heroicons.
- **The tone is anti-metric and load-bearing** (DESIGN.md 9): no ranking, no streaks, no "you're
  behind", no red for low progress. `FinishedReaders` lives closest to the line — alphabetical, no
  average, no count, folded away until asked. Do not "improve" it with a club average.
- `aria-label` and `Intl` output are strings a member reads, so they are pt-BR like the rest.
- Deliberately absent: no UI kit, no CSS framework, no state library beyond the Query cache, no
  jsdom or Testing Library — pure logic goes in a `.ts` beside the component with a `.test.ts`,
  and behaviour that needs a browser is driven through the DevTools MCP. Adding any is a deviation.

## Known traps

- **Field ids come from `useId()`, and on the feed that is load-bearing.** Several cards can be in
  edit mode at once; a hardcoded id would point every `<label htmlFor>` at the first card's input.
  `BookPicker`'s `inputId` prop exists for the same reason — two pickers on one screen collide.
- **`ratingScale.ts` is named apart from `StarRating.tsx` on purpose.** Two files differing only in
  case broke module resolution on a case-insensitive filesystem.
- **`StarRating` is a `role="slider"`, not a radio group** — half stars would need ten inputs and a
  radio ring cannot preview an uncommitted value. What the radios gave for free is now explicit and
  must stay: arrow keys (±0.5), PageUp/PageDown (±1), Home/End, `aria-valuenow`/`aria-valuetext`, a
  focus ring on the bar, and `touch-action: pan-y` — without it a drag scrolls the page.
- **The expanded image is a native `<dialog>` with `showModal()`**, and the top layer is why:
  `body::after` paints the grain at `z-index: 100`, so a `position: fixed` overlay would show the
  photo under it. The image is `contain` and never upscaled (`compress_image` caps it at 1600px).
- **Clash Semibold declares itself as family `"Clash Display Semibold"`**, so `@font-face` renames
  it to `"Clash Display"` weight 600. Undo that and `font-weight` silently stops working.
- **Confirmation is an inline panel, never `window.confirm`** — not pt-BR by our choosing, and not
  in the brand's voice.
