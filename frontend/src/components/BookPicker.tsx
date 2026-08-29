import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../api/client";
import type { Book, ExternalBook } from "../api/types";
import { useDebouncedValue } from "../useDebouncedValue";
import { BookCover } from "./BookCover";
import { bookPayload, externalBookProblem } from "./externalBook";

/** How many external hits to ask for. Five is what fits under the field without a scrollbar. */
const EXTERNAL_LIMIT = 5;

/**
 * The external search only starts at three letters. Every request leaves the building, and one or
 * two letters match a good part of a catalogue of millions — a slow round trip for a list that
 * cannot be the book anyone means.
 */
const EXTERNAL_MIN_CHARS = 3;

/**
 * A longer pause than the local search's 250ms default, because this is the one search in the SPA
 * that can take seconds: the backend allows the Open Library eight of them (guide 6.7). At 250ms
 * a normal typing rhythm would queue several of those against a third party before the member
 * finished the title.
 */
const EXTERNAL_DEBOUNCE_MS = 600;

/**
 * The book selector behind `PostIn.book_id` — used by `NewPost` and by `PostDetail`'s inline
 * edit, which is why it is its own component rather than the inline JSX NewPost started with
 * (guide 7.4's "write it once" applies to any UI reused across screens, not just `PostCard`).
 * `FavoritesShelf` is its third caller.
 *
 * It searches two catalogues, and the order is the point. `GET /api/books?q=` is the club's own
 * shelf — public, instant, and the only one that can already be the answer. `GET /books/external`
 * is the Open Library proxy (guide 6.7), offered only once the local search has come up short:
 * it is authenticated, slow, and its results are not books yet. Choosing one registers it —
 * `POST /api/books` — and the saved `BookOut` is what reaches `onSelect`, never the catalogue hit.
 *
 * **This is where a book gets into the acervo, and it is the only place.** There is no "cadastrar
 * livro" screen and guide 7.4's route table has no room for one; the endpoint map's own line for
 * `POST /api/books` is "cadastra livro (manual ou vindo da API externa)", which is this. See
 * `frontend/CLAUDE.md` for the decision.
 */
export function BookPicker({
  selected,
  onSelect,
  onClear,
  label,
  inputId = "book-picker-input",
}: {
  selected: Book | null;
  onSelect: (book: Book) => void;
  onClear: () => void;
  label: string;
  /**
   * The field's `id`, so `<label htmlFor>` points at it. Fase 5 hardcoded one value because
   * only one picker existed per screen; two on the same screen would collide and the label
   * would address the wrong field. Pass a distinct id whenever that can happen.
   */
  inputId?: string;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  // Opting into the external catalogue is a click, not something that happens on its own: it is
  // a request to a third party on the member's behalf, and it stays on afterwards so refining
  // the term keeps looking out there instead of asking again on every keystroke.
  const [lookingOutside, setLookingOutside] = useState(false);

  const trimmed = query.trim();
  // A short debounce keeps every keystroke from firing its own request against the catalog.
  // Fase 5 wrote this as a local effect; Fase 7 needed the same thing for the member search, so
  // it now comes from the shared hook. Fase 8 calls the same hook a second time with a longer
  // delay rather than growing a second one.
  const debouncedQuery = useDebouncedValue(trimmed);
  const externalQuery = useDebouncedValue(trimmed, EXTERNAL_DEBOUNCE_MS);

  const { data: results } = useQuery({
    queryKey: ["books", "search", debouncedQuery],
    queryFn: () => api<Book[]>(`/books?q=${encodeURIComponent(debouncedQuery)}&limit=5`),
    enabled: debouncedQuery.length > 0,
  });

  const externalReady = lookingOutside && externalQuery.length >= EXTERNAL_MIN_CHARS;
  const external = useQuery({
    queryKey: ["books", "external", externalQuery, EXTERNAL_LIMIT],
    queryFn: () =>
      api<ExternalBook[]>(
        `/books/external?q=${encodeURIComponent(externalQuery)}&limit=${EXTERNAL_LIMIT}`,
      ),
    enabled: externalReady,
  });

  const register = useMutation({
    mutationFn: (hit: ExternalBook) =>
      api<Book>("/books", { method: "POST", body: JSON.stringify(bookPayload(hit)) }),
    onSuccess: (book) => {
      // Only the local searches: the acervo gained a row, so every `["books", "search", …]` entry
      // may now be missing it. The `["books"]` prefix would also sweep `["books", "external", …]`,
      // and refetching that means a second eight-second round trip to the Open Library for a
      // result the member has already chosen and is about to leave.
      queryClient.invalidateQueries({ queryKey: ["books", "search"] });
      pick(book);
    },
  });

  function pick(book: Book) {
    onSelect(book);
    setQuery("");
    setLookingOutside(false);
  }

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

  return (
    <div>
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="field-text"
        type="text"
        placeholder="Buscar no catálogo do clubi"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          // A failed registration is about the hit that was clicked; a new term makes it stale
          // copy sitting under a list it no longer describes.
          if (register.isError) register.reset();
        }}
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

      {debouncedQuery ? (
        <div className="book-picker__external">
          {lookingOutside ? (
            <ExternalCatalogue
              query={externalQuery}
              ready={externalReady}
              loading={external.isLoading}
              error={external.isError ? external.error.message : null}
              hits={external.data}
              registering={register.isPending ? register.variables : null}
              registerError={register.isError ? register.error.message : null}
              onPick={(hit) => register.mutate(hit)}
            />
          ) : (
            <>
              <p className="muted book-picker__external-note">
                O acervo do clubi só tem o que alguém já cadastrou.
              </p>
              <button
                type="button"
                className="button button--quiet"
                onClick={() => setLookingOutside(true)}
              >
                Procurar no catálogo aberto
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The Open Library half of the picker. It takes everything as props and fetches nothing itself
 * (state rule 2) — `BookPicker` owns both queries, so the two halves cannot disagree about the
 * term they are searching for.
 *
 * There is no spinner and no magnifier: the loading state is a sentence, as DESIGN.md 6.3 asks of
 * anything that would otherwise be a functional icon, and it is required rather than polite —
 * eight seconds of a silent panel reads as a broken field.
 */
function ExternalCatalogue({
  query,
  ready,
  loading,
  error,
  hits,
  registering,
  registerError,
  onPick,
}: {
  query: string;
  ready: boolean;
  loading: boolean;
  error: string | null;
  hits: ExternalBook[] | undefined;
  registering: ExternalBook | null;
  registerError: string | null;
  onPick: (hit: ExternalBook) => void;
}) {
  return (
    <>
      <p className="field-label">Catálogo aberto</p>
      <p className="muted book-picker__external-note">
        Escolher um livro aqui também o cadastra no acervo do clubi.
      </p>

      <div aria-live="polite">
        {!ready ? (
          <p className="muted book-picker__external-note">
            Escreva pelo menos {EXTERNAL_MIN_CHARS} letras para procurar lá fora.
          </p>
        ) : null}
        {ready && loading ? (
          <p className="muted book-picker__external-note">
            Procurando “{query}” no catálogo aberto…
          </p>
        ) : null}
        {error ? (
          <p className="notice notice--error">
            <span className="notice__label">Não deu.</span> {error} O acervo do clubi continua
            respondendo no campo acima.
          </p>
        ) : null}
        {registerError ? (
          <p className="notice notice--error">
            <span className="notice__label">Não deu para cadastrar.</span> {registerError} Tente de
            novo ou escolha outro resultado.
          </p>
        ) : null}
      </div>

      {hits && hits.length > 0 ? (
        <ul className="book-picker__results">
          {hits.map((hit, index) => {
            const problem = externalBookProblem(hit);
            const busy = registering === hit;
            return (
              <li key={`${hit.external_id}-${index}`}>
                <button
                  type="button"
                  className="book-picker__result book-picker__result--external"
                  onClick={() => onPick(hit)}
                  disabled={problem !== null || registering !== null}
                >
                  <span className="book-picker__external-cover">
                    <BookCover
                      book={{ title: hit.title, author: hit.author, cover_image: hit.cover_url }}
                    />
                  </span>
                  <span className="book-picker__external-names">
                    <span>{hit.title}</span>
                    <span className="muted">
                      {hit.author || "autoria não informada"}
                      {hit.year ? `, ${hit.year}` : ""}
                    </span>
                    {/* Never colour alone (DESIGN.md 3.3): the reason is the signal, and the
                        disabled row is the second one. */}
                    {problem ? (
                      <span className="book-picker__external-problem">{problem}</span>
                    ) : null}
                    {busy ? <span className="muted">Cadastrando…</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {ready && !loading && !error && hits && hits.length === 0 ? (
        <p className="muted book-picker__empty">
          O catálogo aberto também não tem nada com esse nome. Talvez o título esteja escrito de
          outro jeito por lá.
        </p>
      ) : null}
    </>
  );
}
