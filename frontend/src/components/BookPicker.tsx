import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { Book } from "../api/types";

/**
 * The book selector behind `PostIn.book_id` — used by `NewPost` and by `PostDetail`'s inline
 * edit, which is why it is its own component rather than the inline JSX NewPost started with
 * (guide 7.4's "write it once" applies to any UI reused across screens, not just `PostCard`).
 *
 * Queries `GET /api/books?q=`, the internal catalog — public, and distinct from the external
 * Open Library proxy (`/api/books/external`), which is Fase 9 and out of scope here.
 */
export function BookPicker({
  selected,
  onSelect,
  onClear,
  label,
}: {
  selected: Book | null;
  onSelect: (book: Book) => void;
  onClear: () => void;
  label: string;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // A short debounce keeps every keystroke from firing its own request against the catalog.
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data: results } = useQuery({
    queryKey: ["books", "search", debouncedQuery],
    queryFn: () => api<Book[]>(`/books?q=${encodeURIComponent(debouncedQuery)}&limit=5`),
    enabled: debouncedQuery.length > 0,
  });

  if (selected) {
    return (
      <div className="book-picker__selected">
        <div>
          <p className="field-label">{label}</p>
          <p>
            {selected.title} <span className="muted">— {selected.author}</span>
          </p>
        </div>
        <button type="button" className="button button--quiet" onClick={onClear}>
          Remover
        </button>
      </div>
    );
  }

  function pick(book: Book) {
    onSelect(book);
    setQuery("");
    setDebouncedQuery("");
  }

  return (
    <div>
      <label className="field-label" htmlFor="book-picker-input">
        {label}
      </label>
      <input
        id="book-picker-input"
        className="field-text"
        type="text"
        placeholder="Buscar no catálogo do clubi"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results && results.length > 0 ? (
        <ul className="book-picker__results">
          {results.map((book) => (
            <li key={book.id}>
              <button type="button" className="book-picker__result" onClick={() => pick(book)}>
                <span>{book.title}</span>
                <span className="muted">
                  {book.author}
                  {book.year ? `, ${book.year}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {debouncedQuery && results && results.length === 0 ? (
        <p className="muted book-picker__empty">Nenhum livro encontrado com esse nome.</p>
      ) : null}
    </div>
  );
}
