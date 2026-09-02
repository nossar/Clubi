import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError, api } from "../api/client";
import type { Post } from "../api/types";
import { MemberAvatar } from "../components/MemberAvatar";
import { PostEditForm } from "../components/PostEditForm";
import { PostImages } from "../components/PostImages";
import { useCurrentUser } from "../context/CurrentUser";
import { formatDateTime } from "../format";
import { canManagePost, useDeletePost } from "../posts";

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
 *
 * Both controls are offered here *and* on the feed's card, over the same `useDeletePost` and the
 * same `PostEditForm`: the author who wants a postagem changed or gone should not have to open it
 * first, and the author already reading it should not have to go back.
 */
export function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const postId = Number(id);
  const navigate = useNavigate();
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Shared with PostCard, which offers the same exclusion straight from the feed. Leaving is this
  // caller's own business: the address the browser is sitting on stops existing.
  const deletePost = useDeletePost(postId, () => navigate("/posts"));

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

  // Staff as well as author, mirroring `_own_post` in the backend — see `canManagePost`.
  const isAuthor = canManagePost(post, me);

  return (
    <section className="section">
      <div className="container post-detail">
        <p>
          <Link to="/posts">← Voltar</Link>
        </p>

        <header className="post-card__header">
          <MemberAvatar person={post.author} linkTo={`/u/${post.author.username}`} />
          <div>
            <p className="post-card__author">
              <Link className="post-card__author-link" to={`/u/${post.author.username}`}>
                {post.author.full_name}
              </Link>
            </p>
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

            <PostImages
              images={post.images}
              authorName={post.author.full_name}
              className="post-detail__images"
            />

            {isAuthor ? (
              <div className="post-detail__actions">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => setEditing(true)}
                >
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
          <PostEditForm
            post={post}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        )}
      </div>
    </section>
  );
}
