import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { useEffect } from "react";

import { api } from "../api/client";
import type { PostPage } from "../api/types";
import { BrandElement } from "../components/BrandElement";
import { PostCard } from "../components/PostCard";
import { useCurrentUser } from "../context/CurrentUser";
import { useMarkPostsSeen } from "../unreadPosts";

/**
 * `/posts`. Page lives in the URL (`?page=`), never in `useState` — F5, the back button and a
 * shared link all have to land on the same page (DESIGN.md/frontend CLAUDE.md, state rule 1).
 *
 * "Ver mais" is the only navigation control (DESIGN.md 6.3: the API gives `has_next`, so a
 * chevron pager would be inventing a feature the backend doesn't support). It moves the URL to
 * the next page instead of accumulating pages client-side — `useInfiniteQuery` would erase the
 * page from the URL and break exactly the things rule 1 protects.
 *
 * Arriving here is also what marks the postagens read: one `POST /posts/seen` on mount, which
 * stamps `User.posts_seen_at` and empties the badge on the header's balão. Reading is the whole
 * club's; **writing is the organisation's** (`MeOut.is_staff`), so the "Postar" shortcuts are
 * drawn only for staff — and the backend refuses everyone else regardless, which is what makes
 * hiding them a courtesy rather than the rule.
 *
 * There is no balão on the heading any more: the header carries it, right above, and printing the
 * same drawing twice on one screen is what DESIGN.md 6.2 calls clipart.
 */
export function Feed() {
  const me = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const { mutate: markSeen } = useMarkPostsSeen();

  useEffect(() => {
    markSeen();
  }, [markSeen]);

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
          <h1 className="page-title">Postagens</h1>
          {me.is_staff ? (
            <Link className="button" to="/posts/new">
              Postar
            </Link>
          ) : null}
        </div>

        {isPending ? <p className="muted">Carregando as postagens…</p> : null}

        {error ? (
          <p className="notice notice--error">
            <span className="notice__label">Não deu para carregar o feed.</span> {error.message}{" "}
            Recarregue a página para tentar de novo.
          </p>
        ) : null}

        {data && data.items.length === 0 ? (
          <div className="state">
            <BrandElement name="nuvem" />
            <h2 className="state__title">ainda não há postagens</h2>
            {me.is_staff ? (
              <>
                <p>Que tal ser a primeira pessoa a contar o que está achando da leitura do mês?</p>
                <p>
                  <Link className="button" to="/posts/new">
                    Postar a primeira
                  </Link>
                </p>
              </>
            ) : (
              <p>
                A organização do clubi ainda não postou nada. Quando postar, você encontra tudo
                por aqui.
              </p>
            )}
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
