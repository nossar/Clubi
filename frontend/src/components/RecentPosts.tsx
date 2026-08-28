import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import type { PostPage } from "../api/types";
import { BrandElement } from "./BrandElement";
import { PostCard } from "./PostCard";

const HOME_PREVIEW_COUNT = 3;

/**
 * The Home's feed preview. Queries `["posts", 1]` — the same key `Feed` uses for its first page
 * — so the two never hold separate copies of the same data (frontend/CLAUDE.md's queryKey
 * table). Only the first three posts render; the rest of the fetched page is there for `Feed`'s
 * cache, not wasted.
 */
export function RecentPosts() {
  const { data, isPending, error } = useQuery({
    queryKey: ["posts", 1],
    queryFn: () => api<PostPage>("/posts?page=1"),
  });

  if (isPending) {
    return (
      <section className="section">
        <div className="container">
          <p className="muted">Carregando publicações…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <p className="notice notice--error">
            <span className="notice__label">Não deu para carregar as publicações.</span>{" "}
            {error.message}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <h2 className="section-title">Publicações recentes</h2>

        {data.items.length === 0 ? (
          <div className="state">
            <BrandElement name="nuvem" />
            <p>Ainda não há publicações. Que tal contar o que você está achando da leitura?</p>
            <p>
              <Link className="button" to="/posts/new">
                Publicar algo
              </Link>
            </p>
          </div>
        ) : (
          <>
            <ul className="post-list">
              {data.items.slice(0, HOME_PREVIEW_COUNT).map((post) => (
                <li key={post.id}>
                  <PostCard post={post} />
                </li>
              ))}
            </ul>
            <p className="feed__more">
              <Link className="button button--quiet" to="/posts">
                Ver todas as publicações
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
