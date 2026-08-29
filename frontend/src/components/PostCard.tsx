import { Link } from "react-router-dom";

import type { Post } from "../api/types";
import { formatDateTime } from "../format";
import { MemberAvatar } from "./MemberAvatar";

/**
 * Renders on Home and Feed (guide 7.4: "write it once; three near-copies is how they diverge").
 * The guide expected Profile to be its third caller; it is not, because `GET /api/posts` has no
 * author filter — see frontend/CLAUDE.md's note under Profile.
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
            <img key={src} src={src} alt={`Imagem ${index + 1} da publicação de ${post.author.full_name}`} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
