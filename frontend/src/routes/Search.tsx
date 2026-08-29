import { Link, useSearchParams } from "react-router-dom";

import { BrandElement } from "../components/BrandElement";
import { MemberAvatar } from "../components/MemberAvatar";
import { searchTerm, useMemberSearch } from "../components/MemberSearch";
import { useDebouncedValue } from "../useDebouncedValue";

/** The API caps `limit` at 50, so asking for more would quietly get 50 anyway. */
const MEMBER_LIMIT = 50;

/**
 * `/search` — who is in the club, and how to find one of them.
 *
 * The term lives in `?q=` and nowhere else (state rule 1): F5, the back button and a link sent to
 * a friend all have to land on the same list. The field that edits it is the header's
 * `MemberSearch`, which binds itself to this screen's `?q=` — one box on screen, not two.
 *
 * **With no term the screen lists the club** instead of sitting empty waiting to be typed at.
 * `search_users` answers an empty `q` with every active member, ordered by name (`User.Meta`),
 * so this costs no endpoint and reads the way DESIGN.md 9 asks an empty state to read: an
 * invitation, and a club you can browse. No ranking, no ordering by activity — the list is
 * alphabetical and says nothing about who reads more.
 */
export function Search() {
  const [searchParams] = useSearchParams();
  const term = searchTerm(searchParams.get("q") ?? "");
  const debouncedTerm = useDebouncedValue(term);
  const { data: members, isPending, error } = useMemberSearch(debouncedTerm, MEMBER_LIMIT);

  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title">{debouncedTerm ? "Resultados" : "Membros do clubi"}</h1>
        <p className="muted search__lead">
          {debouncedTerm
            ? `Quem tem “${debouncedTerm}” no nome ou no nome de usuário.`
            : "Todo mundo que faz parte. Para encontrar alguém, use o campo de busca no topo da página."}
        </p>

        {isPending ? <p className="muted search__results">Procurando…</p> : null}

        {error ? (
          <p className="notice notice--error search__results">
            <span className="notice__label">Não deu para fazer a busca.</span> {error.message}{" "}
            Recarregue a página para tentar de novo.
          </p>
        ) : null}

        {members && members.length === 0 ? (
          <div className="state search__results">
            <BrandElement name="nuvem" />
            {debouncedTerm ? (
              <>
                <h2 className="state__title">ninguém com esse nome</h2>
                <p>
                  Vale tentar só o primeiro nome, ou o nome de usuário — com ou sem o @. Quem você
                  procura também pode ainda não ter entrado no clubi.
                </p>
              </>
            ) : (
              <p>Por enquanto, só você por aqui. Chame alguém do clube para entrar junto.</p>
            )}
          </div>
        ) : null}

        {members && members.length > 0 ? (
          <>
            <ul className="member-list search__results">
              {members.map((person) => (
                <li key={person.username}>
                  <Link className="member-card" to={`/u/${person.username}`}>
                    <MemberAvatar person={person} />
                    <span>
                      <span className="member-card__name">
                        {person.full_name || person.username}
                      </span>
                      <span className="muted member-card__username">@{person.username}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {!debouncedTerm && members.length === MEMBER_LIMIT ? (
              <p className="muted search__note">
                Estes são os primeiros {MEMBER_LIMIT}. Digite um nome no topo para encontrar
                alguém específico.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
