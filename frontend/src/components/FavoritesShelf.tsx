import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import type { Book, FavoritesPayload } from "../api/types";
import { useCurrentUser } from "../context/CurrentUser";
import { BookCover } from "./BookCover";
import { BookPicker } from "./BookPicker";
import { BrandElement } from "./BrandElement";

const MAX_FAVORITES = 4;

/**
 * `BookOut.id` is optional in the generated schema — `ModelSchema` derives it from Django's
 * AutoField, which is null until the row is saved. Everything the API hands back is saved, so
 * the narrowing happens once here, at the boundary, instead of an assertion at every use.
 */
type ShelfBook = Book & { id: number };

function isShelfBook(book: Book): book is ShelfBook {
  return typeof book.id === "number";
}

function sameOrder(a: Book[], b: Book[]): boolean {
  return a.length === b.length && a.every((book, index) => book.id === b[index].id);
}

/**
 * The four-book shelf. `UserOut.favorites` is a plain `BookOut[]` already in slot order
 * (`Favorite.Meta.ordering`) — `position` never crosses the wire on the way out, so the order
 * *is* the array index, and saving rebuilds `position` as index + 1.
 *
 * Editing is atomic replacement, not add/remove/reorder (ADR-08, guide 6.5): the whole shelf is
 * arranged in local state and then `PUT /api/me/favorites` replaces it in one transaction.
 *
 * Two things the interface has to guarantee rather than discover from the API:
 *
 * - **The 422 must be unreachable.** `FavoritesIn` caps the list at 4 and `position` at 1–4, and
 *   Pydantic answers a violation with an English, array-shaped `detail` (see client.ts). So the
 *   editor locks at four slots and generates contiguous 1..N positions itself. A gap in the
 *   positions would be accepted by the API and then be invisible on read, which is worse.
 * - **Reordering is words, not drag-and-drop.** "Subir"/"Descer" is what DESIGN.md 6.3 asks for,
 *   and a drag library would be a stack deviation (frontend/CLAUDE.md) for one control on one
 *   screen — while also being the harder thing to operate by keyboard and by touch.
 */
export function FavoritesShelf({
  books,
  editable = false,
  canEdit = false,
}: {
  books: Book[];
  /** Renders the editor. Only ever true on your own shelf — the API writes `/me/favorites`. */
  editable?: boolean;
  /** Whether the shelf being shown is yours, which decides where the empty state points. */
  canEdit?: boolean;
}) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ShelfBook[]>(books.filter(isShelfBook));
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const payload: FavoritesPayload = {
        favorites: draft.map((book, index) => ({ book_id: book.id, position: index + 1 })),
      };
      return api<Book[]>("/me/favorites", { method: "PUT", body: JSON.stringify(payload) });
    },
    onSuccess: (saved) => {
      setDraft(saved.filter(isShelfBook));
      // UserOut embeds favorites, so /api/me — the CurrentUserProvider's source — goes stale
      // too, not just the profile screen.
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["user", me.username] });
    },
  });

  if (!editable) {
    if (books.length === 0) {
      // An empty state is an invitation, never "nenhum registro encontrado" (DESIGN.md 9).
      return (
        <div className="state">
          <BrandElement name="nuvem" />
          <p>
            {canEdit
              ? "Sua estante está vazia. Escolha até quatro livros que dizem alguma coisa sobre você."
              : "Esta pessoa ainda não montou a estante dela."}
          </p>
          {canEdit ? (
            <p>
              <Link className="button" to="/profile/edit">
                Montar a estante
              </Link>
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <ol className="shelf">
        {books.map((book) => (
          <li className="shelf__item" key={book.id}>
            <BookCover book={book} />
            <p className="shelf__title">{book.title}</p>
            <p className="muted shelf__author">{book.author}</p>
          </li>
        ))}
      </ol>
    );
  }

  function add(book: Book) {
    if (!isShelfBook(book)) return;
    if (draft.length >= MAX_FAVORITES) {
      setProblem(`A estante tem ${MAX_FAVORITES} lugares. Tire um livro para pôr outro.`);
      return;
    }
    if (draft.some((chosen) => chosen.id === book.id)) {
      setProblem("Esse livro já está na sua estante.");
      return;
    }
    setProblem(null);
    setDraft([...draft, book]);
  }

  function remove(index: number) {
    setProblem(null);
    setDraft(draft.filter((_, i) => i !== index));
  }

  function move(index: number, to: number) {
    if (to < 0 || to >= draft.length) return;
    const next = [...draft];
    [next[index], next[to]] = [next[to], next[index]];
    setProblem(null);
    setDraft(next);
  }

  const isFull = draft.length >= MAX_FAVORITES;
  const dirty = !sameOrder(draft, books);

  return (
    <div className="shelf-editor">
      {draft.length > 0 ? (
        <ol className="shelf">
          {draft.map((book, index) => (
            <li className="shelf__item" key={book.id}>
              <BookCover book={book} />
              <p className="shelf__title">{book.title}</p>
              <p className="muted shelf__author">{book.author}</p>
              <div className="shelf__controls">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                >
                  Subir
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === draft.length - 1}
                >
                  Descer
                </button>
                <button className="button button--quiet" type="button" onClick={() => remove(index)}>
                  Tirar
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">
          Sua estante está vazia. Escolha até quatro livros que dizem alguma coisa sobre você.
        </p>
      )}

      {!isFull ? (
        <div className="field">
          {/* One picker at a time, and it carries its own id — two on a screen would collide on
              the id Fase 5 hardcoded, and the label would then address the wrong field. */}
          <BookPicker
            inputId="shelf-book-picker"
            selected={null}
            onSelect={add}
            onClear={() => setProblem(null)}
            label={`Adicionar um livro (${draft.length} de ${MAX_FAVORITES})`}
          />
        </div>
      ) : (
        <p className="muted">
          A estante está cheia. Tire um livro para abrir espaço — são quatro lugares, de propósito.
        </p>
      )}

      <div aria-live="polite">
        {problem ? (
          <p className="notice notice--error">
            <span className="notice__label">Não deu.</span> {problem}
          </p>
        ) : null}
        {save.isError ? (
          <p className="notice notice--error">
            <span className="notice__label">Não deu para salvar a estante.</span>{" "}
            {save.error.message} Ajuste e tente de novo.
          </p>
        ) : null}
        {save.isSuccess && !dirty ? (
          <p className="notice notice--ok">
            <span className="notice__label">Estante salva.</span> É ela que aparece no seu perfil.
          </p>
        ) : null}
      </div>

      <div className="shelf-editor__actions">
        <button
          className="button"
          type="button"
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
        >
          {save.isPending ? "Salvando…" : "Salvar estante"}
        </button>
        {dirty ? (
          <button
            className="button button--quiet"
            type="button"
            onClick={() => {
              setDraft(books.filter(isShelfBook));
              setProblem(null);
            }}
          >
            Desfazer
          </button>
        ) : null}
      </div>
    </div>
  );
}
