import { useState } from "react";
import { Link } from "react-router-dom";

import type { Post } from "../api/types";
import { useCurrentUser } from "../context/CurrentUser";
import { formatDateTime } from "../format";
import { canManagePost, useDeletePost } from "../posts";
import { MemberAvatar } from "./MemberAvatar";
import { PostEditForm } from "./PostEditForm";

/**
 * Renders on the Feed, and nowhere else since the Home stopped previewing postagens. Guide 7.4
 * expected three callers: Profile is not one, because `GET /api/posts` has no author filter (see
 * frontend/CLAUDE.md), and the Home is not one any more either.
 *
 * This is functional core, not frame (DESIGN.md 7) — no checker, no tilt, no stamp; the card
 * itself is a plain cream surface.
 *
 * The author can edit or erase their own postagem from here without opening it, the same way they
 * can from `PostDetail` — one `PostEditForm` and one `useDeletePost` behind both. The controls are
 * **the words "Editar" and "Excluir"**, not a lápis and a lixeira: DESIGN.md 6.3 rule 2 names
 * those exact icons and those exact replacements. The one place the site does draw glyphs instead
 * (E-15, the shelf's arrows) was a density case — twelve labels in a grid of four 7rem columns —
 * and two controls on a card is not that.
 *
 * Editing swaps the card for the form rather than opening the postagem, which is the same move
 * `PostDetail` makes on its own article. The body arrives whole in `PostOut` — the four-line
 * clamp on `.post-card__body` is CSS, so nothing has to be fetched to edit here.
 *
 * Erasing is two clicks, and the second one is in a panel that says so. The card is a scanning
 * surface: "Excluir" sits next to a title the member is skimming, so a single click there would
 * be a mis-tap away from an irreversible loss. `window.confirm` was not an option — the site
 * writes its own notices, and the browser dialog is neither in the brand's voice nor in pt-BR by
 * our choosing.
 */
export function PostCard({ post }: { post: Post }) {
  const me = useCurrentUser();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const deletePost = useDeletePost(post.id);

  const canManage = canManagePost(post, me);

  if (canManage && editing) {
    return (
      <article className="post-card">
        <PostEditForm
          post={post}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </article>
    );
  }

  return (
    <article className="post-card">
      <header className="post-card__header">
        <MemberAvatar person={post.author} />
        <div>
          <p className="post-card__author">
            <Link className="post-card__author-link" to={`/u/${post.author.username}`}>
              {post.author.full_name}
            </Link>
          </p>
          <p className="muted post-card__date">{formatDateTime(post.created_at)}</p>
        </div>
      </header>

      <Link className="post-card__title-link" to={`/posts/${post.id}`}>
        <h3 className="post-card__title">{post.title}</h3>
      </Link>

      {post.book ? (
        <p className="muted post-card__book">
          sobre <strong>{post.book.title}</strong>, {post.book.author}
        </p>
      ) : null}

      <p className="post-card__body">{post.body}</p>

      {post.images.length > 0 ? (
        <div className="post-card__images">
          {post.images.map((src, index) => (
            <img key={src} src={src} alt={`Imagem ${index + 1} da postagem de ${post.author.full_name}`} />
          ))}
        </div>
      ) : null}

      {canManage && !confirming ? (
        <div className="post-card__manage">
          {/* The card gives no other context, so each accessible name carries the postagem —
              ten cards on the feed would otherwise offer ten controls called "Editar". */}
          <button
            className="button button--quiet"
            type="button"
            aria-label={`Editar a postagem “${post.title}”`}
            onClick={() => setEditing(true)}
          >
            Editar
          </button>
          <button
            className="button button--quiet"
            type="button"
            aria-label={`Excluir a postagem “${post.title}”`}
            onClick={() => setConfirming(true)}
          >
            Excluir
          </button>
        </div>
      ) : null}

      {canManage && confirming ? (
        <div className="post-card__confirm" aria-live="polite">
          <p className="post-card__confirm-text">
            Excluir “{post.title}”? Essa ação não pode ser desfeita.
          </p>
          <div className="post-card__confirm-actions">
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
              onClick={() => setConfirming(false)}
              disabled={deletePost.isPending}
            >
              Cancelar
            </button>
          </div>
          {deletePost.isError ? (
            <p className="notice notice--error">
              <span className="notice__label">Não deu para excluir.</span>{" "}
              {deletePost.error.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
