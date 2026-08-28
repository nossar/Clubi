import type { Book } from "../api/types";

/**
 * `cover_image` is a URL string and is "" when the book has neither an upload nor an external
 * cover, so a placeholder is not optional. It is typographic on purpose: a graphic element here
 * would spend one of the two the screen is allowed (DESIGN.md 6.2).
 */
export function BookCover({ book }: { book: Book }) {
  if (!book.cover_image) {
    return (
      <div className="book-cover book-cover--blank">
        <p className="book-cover__title">{book.title}</p>
        <p className="book-cover__author">{book.author}</p>
      </div>
    );
  }

  return (
    <div className="book-cover">
      <img src={book.cover_image} alt={`Capa de ${book.title}`} />
    </div>
  );
}
