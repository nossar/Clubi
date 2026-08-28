import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import type { PostPage } from "../api/types";
import { BrandElement } from "../components/BrandElement";
import { PostCard } from "../components/PostCard";

/**
 * `/posts`. Page lives in the URL (`?page=`), never in `useState` — F5, the back button and a
 * shared link all have to land on the same page (DESIGN.md/frontend CLAUDE.md, state rule 1).
 *
 * "Ver mais" is the only navigation control (DESIGN.md 6.3: the API gives `has_next`, so a
 * chevron pager would be inventing a feature the backend doesn't support). It moves the URL to
 * the next page instead of accumulating pages client-side — `useInfiniteQuery` would erase the
 * page from the URL and break exactly the things rule 1 protects.
 */
export function Feed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = Number(searchParams.get("page"));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const { data, isPending, error } = useQuery({
    queryKey: ["posts", page],
    queryFn: () => api<PostPage>(`/posts?page=${page}`),
  });

  function goToNextPage() {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page + 1));
    setSearchParams(next);
  }

  return (
    <section className="section">
      <div className="container">
        <div className="feed__heading">
          <h1 className="feed__title">
            <BrandElement name="balao" />
            Publicações
          </h1>
          <Link className="button" to="/posts/new">
            Publicar
          </Link>
        </div>

        {isPending ? <p className="muted">Carregando publicações…</p> : null}

        {error ? (
          <p className="notice notice--error">
            <span className="notice__label">Não deu para carregar o feed.</span> {error.message}{" "}
            Recarregue a página para tentar de novo.
          </p>
        ) : null}

        {data && data.items.length === 0 ? (
          <div className="state">
            <BrandElement name="nuvem" />
            <h2 className="state__title">ainda não há publicações</h2>
            <p>Que tal ser a primeira pessoa a contar o que está achando da leitura do mês?</p>
            <p>
              <Link className="button" to="/posts/new">
                Publicar a primeira
              </Link>
            </p>
          </div>
        ) : null}

        {data && data.items.length > 0 ? (
          <>
            <ul className="post-list">
              {data.items.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} />
                </li>
              ))}
            </ul>

            {data.has_next ? (
              <p className="feed__more">
                <button className="button" type="button" onClick={goToNextPage}>
                  Ver mais
                </button>
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
