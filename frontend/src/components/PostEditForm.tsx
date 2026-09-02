import { useId, useState } from "react";
import type { FormEvent } from "react";

import type { Book, Post } from "../api/types";
import { postEditPayload, useUpdatePost } from "../posts";
import { BookPicker } from "./BookPicker";

/**
 * The edit form for one postagem, wherever it is being edited: inline on `/posts/:id` and inline
 * on the feed's card. It was `PostDetail`'s own JSX until the feed grew an "Editar" of its own —
 * two copies of a form whose payload rules are subtle (see `postEditPayload`) is exactly the
 * duplication guide 7.4's "write it once" is about.
 *
 * **Every field id comes from `useId()`**, which is not cosmetic here. `PostDetail` could hardcode
 * `edit-title` because there is only ever one postagem on that screen; the feed can have ten cards
 * open at once, and ten `<label htmlFor="edit-title">` would all point at the first card's input —
 * clicking a label would focus another postagem's field. `BookPicker` already took an `inputId`
 * prop for this same reason, and it gets one here.
 *
 * Images are deliberately absent: the backend has no endpoint to detach an already-uploaded one,
 * so a control for it would be UI for a capability that does not exist server-side.
 */
export function PostEditForm({
  post,
  onDone,
  onCancel,
}: {
  post: Post;
  /** Called after a successful save. */
  onDone: () => void;
  /** Called when the member backs out, and when there was nothing to save. */
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [book, setBook] = useState<Book | null>(post.book);

  const updatePost = useUpdatePost(post.id, onDone);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;

    const payload = postEditPayload(post, {
      title: title.trim(),
      body: body.trim(),
      bookId: book?.id ?? null,
    });

    // Nothing changed: closing is the honest answer, not a PATCH that writes what is already there.
    if (Object.keys(payload).length === 0) {
      onCancel();
      return;
    }
    updatePost.mutate(payload);
  }

  return (
    <form className="post-form" onSubmit={onSubmit}>
      <div className="field">
        <label className="field-label" htmlFor={`${fieldId}-title`}>
          Título
        </label>
        <input
          id={`${fieldId}-title`}
          className="field-text"
          type="text"
          maxLength={140}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${fieldId}-body`}>
          Texto
        </label>
        <textarea
          id={`${fieldId}-body`}
          className="field-textarea"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
        />
      </div>

      <div className="field">
        <BookPicker
          selected={book}
          onSelect={setBook}
          onClear={() => setBook(null)}
          label="Sobre qual livro?"
          inputId={`${fieldId}-book`}
        />
      </div>

      <div aria-live="polite">
        {updatePost.isError ? (
          <p className="notice notice--error">
            <span className="notice__label">Não deu para salvar.</span> {updatePost.error.message}
          </p>
        ) : null}
      </div>

      <div className="post-detail__actions">
        <button className="button" type="submit" disabled={updatePost.isPending}>
          {updatePost.isPending ? "Salvando…" : "Salvar"}
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={onCancel}
          disabled={updatePost.isPending}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
