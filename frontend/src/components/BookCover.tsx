import { useState } from "react";

import type { Book } from "../api/types";

/**
 * Not a whole `BookOut`: the external catalogue's hits have a `cover_url` and no `id`, `synopsis`
 * or database row at all, and they need the same drawing. Narrowing to the three fields the cover
 * actually reads is what lets `BookPicker` show one before the book exists.
 */
type CoverSubject = Pick<Book, "title" | "author"> & { cover_image: string };

/**
 * `cover_image` is a URL string and is "" when the book has neither an upload nor an external
 * cover, so a placeholder is not optional. It is typographic on purpose: a graphic element here
 * would spend one of the two the screen is allowed (DESIGN.md 6.2).
 *
 * The same placeholder catches a cover that is *declared* and does not load. That is not
 * hypothetical since Fase 8: a book registered from the external catalogue keeps pointing at
 * `covers.openlibrary.org`, a third party that can 404, rate-limit or be blocked — and without
 * `onError` the frame would hold the browser's broken-image glyph, which is neither the brand's
 * stroke nor a word (DESIGN.md 6.3). The failed URL is remembered rather than a bare boolean, so
 * a new cover on the same component gets its own chance to load.
 *
 * Everything rendered here is phrasing content, so the cover nests legally inside the `<button>`
 * of an external result row.
 */
export function BookCover({ book }: { book: CoverSubject }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!book.cover_image || failedUrl === book.cover_image) {
    return (
      <span className="book-cover book-cover--blank">
        <span className="book-cover__title">{book.title}</span>
        <span className="book-cover__author">{book.author}</span>
      </span>
    );
  }

  return (
    <span className="book-cover">
      <img
        src={book.cover_image}
        alt={`Capa de ${book.title}`}
        onError={() => setFailedUrl(book.cover_image)}
      />
    </span>
  );
}
