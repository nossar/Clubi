import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError, api } from "../api/client";
import type { Book, Post, PostPatch } from "../api/types";
import { BookPicker } from "../components/BookPicker";
import { MemberAvatar } from "../components/MemberAvatar";
import { useCurrentUser } from "../context/CurrentUser";
import { formatDateTime } from "../format";

function NotFoundState() {
  return (
    <section className="section">
      <div className="container state">
        <h1 className="state__title">esta postagem não existe</h1>
        <p>Pode ter sido removida, ou o endereço está errado.</p>
        <p>
          <Link to="/posts">← Voltar para o feed</Link>
        </p>
      </div>
    </section>
  );
}

/**
 * `/posts/:id`. `read_post` filters `published=True` like `list_posts` does, so a post
 * unpublished through the Admin 404s even for its own author — the same 404 branch handles "no
 * such post" and "not published right now", which is the intended behaviour, not a gap.
 *
 * Edit and delete are inline, not separate routes: the guide's route table has no `/posts/:id/edit`,
 * and the backend has no endpoint to detach an already-uploaded image, so edit only ever touches
 * title, body and the linked book — adding image management here would be a UI for a capability
 * that does not exist server-side.
 */
export function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const postId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useCurrentUser();

  const {
    data: post,
    isPending,
    error,
  } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => api<Post>(`/posts/${postId}`),
    enabled: Number.isInteger(postId),
  });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const updatePost = useMutation({
    mutationFn: (payload: PostPatch) =>
      api<Post>(`/posts/${postId}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["post", postId], updated);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setEditing(false);
    },
  });

  // DELETE answers 204 with no body — client.ts's api<T>() returns undefined for that status
  // rather than throwing on the empty response.
  const deletePost = useMutation({
    mutationFn: () => api<undefined>(`/posts/${postId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      navigate("/posts");
    },
  });

  if (!Number.isInteger(postId)) {
    return <NotFoundState />;
  }

  if (isPending) {
    return (
      <section className="section">
        <div className="container">
          <p className="muted">Carregando a postagem…</p>
        </div>
      </section>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundState />;
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <p className="notice notice--error">
            <span className="notice__label">Não deu para carregar a postagem.</span>{" "}
            {error.message}
          </p>
        </div>
      </section>
    );
  }

  if (!post) return null;

  // Staff as well as author: only the organisation writes, and `update_post`/`delete_post`
  // check both. A member who was demoted keeps their old postagens on screen and loses the
  // buttons — which is what the API would tell them anyway, only without the failed request.
  const isAuthor = post.author.username === me.username && me.is_staff;

  function startEditing() {
    if (!post) return;
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditBook(post.book);
    setEditing(true);
  }

  function onSubmitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post) return;
    if (!editTitle.trim() || !editBody.trim()) return;

    // Only changed fields go in the payload: update_post only accepts null for book_id, so an
    // untouched title/body must stay absent from the request rather than round-trip as null.
    const payload: PostPatch = {};
    if (editTitle.trim() !== post.title) payload.title = editTitle.trim();
    if (editBody.trim() !== post.body) payload.body = editBody.trim();
    const currentBookId = post.book?.id ?? null;
    const nextBookId = editBook?.id ?? null;
    if (nextBookId !== currentBookId) payload.book_id = nextBookId;

    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }
    updatePost.mutate(payload);
  }

  return (
    <section className="section">
      <div className="container post-detail">
        <p>
          <Link to="/posts">← Voltar</Link>
        </p>

        <header className="post-card__header">
          <MemberAvatar person={post.author} />
          <div>
            <p className="post-card__author">{post.author.full_name}</p>
            <p className="muted post-card__date">{formatDateTime(post.created_at)}</p>
          </div>
        </header>

        {!editing ? (
          <>
            <h1 className="post-detail__title">{post.title}</h1>

            {post.book ? (
              <p className="muted post-card__book">
                sobre <strong>{post.book.title}</strong>, {post.book.author}
              </p>
            ) : null}

            <p className="post-detail__body">{post.body}</p>

            {post.images.length > 0 ? (
              <div className="post-card__images post-detail__images">
                {post.images.map((src, index) => (
                  <img
                    key={src}
                    src={src}
                    alt={`Imagem ${index + 1} da postagem de ${post.author.full_name}`}
                  />
                ))}
              </div>
            ) : null}

            {isAuthor ? (
              <div className="post-detail__actions">
                <button className="button button--quiet" type="button" onClick={startEditing}>
                  Editar
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Excluir
                </button>
              </div>
            ) : null}

            {confirmingDelete ? (
              <div className="post-detail__confirm">
                <p className="notice notice--error">
                  <span className="notice__label">Tem certeza?</span> Essa ação não pode ser
                  desfeita.
                </p>
                <div className="post-detail__actions">
                  <button
                    className="button"
                    type="button"
                    onClick={() => deletePost.mutate()}
                    disabled={deletePost.isPending}
                  >
                    {deletePost.isPending ? "Excluindo…" : "Confirmar exclusão"}
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancelar
                  </button>
                </div>
                {deletePost.isError ? (
                  <p className="notice notice--error">{deletePost.error.message}</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <form className="post-form" onSubmit={onSubmitEdit}>
            <div className="field">
              <label className="field-label" htmlFor="edit-title">
                Título
              </label>
              <input
                id="edit-title"
                className="field-text"
                type="text"
                maxLength={140}
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="edit-body">
                Texto
              </label>
              <textarea
                id="edit-body"
                className="field-textarea"
                value={editBody}
                onChange={(event) => setEditBody(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <BookPicker
                selected={editBook}
                onSelect={setEditBook}
                onClear={() => setEditBook(null)}
                label="Sobre qual livro?"
              />
            </div>

            <div aria-live="polite">
              {updatePost.isError ? (
                <p className="notice notice--error">
                  <span className="notice__label">Não deu para salvar.</span>{" "}
                  {updatePost.error.message}
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
                onClick={() => setEditing(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
