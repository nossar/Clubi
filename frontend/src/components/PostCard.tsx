import { Link } from "react-router-dom";

import type { Post } from "../api/types";
import { formatDateTime } from "../format";
import { MemberAvatar } from "./MemberAvatar";

/**
 * Renders on the Feed, and nowhere else since the Home stopped previewing postagens. Guide 7.4
 * expected three callers: Profile is not one, because `GET /api/posts` has no author filter (see
 * frontend/CLAUDE.md), and the Home is not one any more either.
 *
 * This is functional core, not frame (DESIGN.md 7) — no checker, no tilt, no stamp; the card
 * itself is a plain cream surface.
 */
export function PostCard({ post }: { post: Post }) {
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
    </article>
  );
}
