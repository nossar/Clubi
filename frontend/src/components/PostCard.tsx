import { Link } from "react-router-dom";

import type { Post } from "../api/types";
import { formatDateTime, initials } from "../format";

/**
 * Renders on Home, Feed and PostDetail's "you might also read" — well, just Home and Feed for
 * now (DESIGN.md 6.3, guide 7.4: "write it once; three near-copies is how they diverge").
 *
 * The author's name is plain text, not a link: `/u/:username` doesn't exist until Fase 6, and a
 * click that lands on the not-found screen is worse than no link at all. This is functional
 * core, not frame (DESIGN.md 7) — no checker, no tilt, no stamp; the card itself is a plain
 * cream surface.
 */
export function PostCard({ post }: { post: Post }) {
  return (
    <article className="post-card">
      <header className="post-card__header">
        {post.author.photo ? (
          <img className="avatar" src={post.author.photo} alt="" width={44} height={44} />
        ) : (
          <span className="avatar" aria-hidden="true">
            {initials(post.author.full_name || post.author.username)}
          </span>
        )}
        <div>
          <p className="post-card__author">{post.author.full_name}</p>
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
