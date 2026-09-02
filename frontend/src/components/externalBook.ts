/* Turning an Open Library hit into a `POST /api/books` body, kept out of `BookPicker` so it can
 * be tested without a browser: everything here is a pure function of one object.
 *
 * Guide 6.7 says `ExternalBookOut` carries "exatamente os campos que o `BookIn` aceita", and that
 * is true field for field. What it does not say is that the two disagree on *ranges*: the Open
 * Library is a public catalogue with catalogue-quality data, and `BookIn` (and the `Book` columns
 * behind it) are bounded. Posting a hit straight through therefore has two failure modes, and
 * they are not the same kind of problem:
 *
 * - **Metadata that does not fit is dropped.** Year, page count, cover URL and external id are
 *   optional in `BookIn` — a book without them is still a correct record, so a value outside the
 *   bounds is left out rather than allowed to fail the request.
 * - **Identity that does not fit blocks the registration.** Title and author are what the book
 *   *is*, and `Book` is unique on the pair. Truncating them would invent a book that does not
 *   exist, so `externalBookProblem` says so in Portuguese and the row refuses to be clicked.
 *
 * Without this the failure is a 422 whose `detail` is a Pydantic array, which `client.ts` flattens
 * to "Os dados enviados não foram aceitos." — a sentence that tells the member nothing about
 * which of a dozen results is the problem or what to do next (DESIGN.md 9: an error explains and
 * offers a way out).
 */

import type { BookPayload, ExternalBook } from "../api/types";

/** From `BookIn` (backend/books/schemas.py), which mirrors the `Book` columns. */
const MAX_TITLE = 200;
const MAX_AUTHOR = 140;
const MIN_YEAR = 0;
const MAX_YEAR = 2200;
const MIN_PAGES = 1;

/* Bounded by the model but *not* by `BookIn`, so Ninja would let these through to the database:
   `Book.cover_url` is a URLField (200) and `Book.external_id` a CharField(60). SQLite would store
   an over-long value silently; the Neon Postgres of ADR-13 would raise DataError and answer 500.
   Both are optional, so the same "drop what does not fit" rule covers them. */
const MAX_COVER_URL = 200;
const MAX_EXTERNAL_ID = 60;

/**
 * Why this hit cannot become a book, in Portuguese — or `null` when it can.
 *
 * Only identity is checked here. Everything else `bookPayload` quietly drops.
 */
export function externalBookProblem(hit: ExternalBook): string | null {
  if (!hit.title.trim()) {
    return "Este resultado veio sem título, então não dá para cadastrar.";
  }
  if (hit.title.length > MAX_TITLE) {
    return `O título tem mais de ${MAX_TITLE} caracteres e não cabe no acervo.`;
  }
  if (hit.author.length > MAX_AUTHOR) {
    return `A lista de autoria tem mais de ${MAX_AUTHOR} caracteres e não cabe no acervo.`;
  }
  return null;
}

function withinRange(value: number | null, min: number, max: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value >= min && value <= max ? value : null;
}

function withinLength(value: string, max: number): string {
  return value.length <= max ? value : "";
}

/**
 * The `POST /api/books` body for a hit `externalBookProblem` has cleared.
 *
 * `synopsis` is always `""`: the search returns none, and `BookIn` requires the field. That is the
 * one real gap between the two schemas — a book registered from here has no synopsis until
 * someone writes one in the Admin (ADR-14).
 */
export function bookPayload(hit: ExternalBook): BookPayload {
  return {
    title: hit.title,
    author: hit.author,
    // Ancient works come back with a negative first_publish_year, which `ge=0` rejects.
    year: withinRange(hit.year, MIN_YEAR, MAX_YEAR),
    pages: withinRange(hit.pages, MIN_PAGES, Number.MAX_SAFE_INTEGER),
    synopsis: "",
    cover_url: withinLength(hit.cover_url, MAX_COVER_URL),
    external_id: withinLength(hit.external_id, MAX_EXTERNAL_ID),
  };
}
