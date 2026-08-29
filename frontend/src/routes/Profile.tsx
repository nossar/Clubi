import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ApiError, api } from "../api/client";
import type { ReadingHistory, UserProfile } from "../api/types";
import { BookCover } from "../components/BookCover";
import { BrandElement } from "../components/BrandElement";
import { FavoritesShelf } from "../components/FavoritesShelf";
import { StarRating } from "../components/StarRating";
import { useCurrentUser } from "../context/CurrentUser";
import { formatDay, formatMonth, initials } from "../format";

function NotFoundState() {
  return (
    <section className="section">
      <div className="container state">
        <h1 className="state__title">esse membro não existe</h1>
        <p>O endereço pode estar errado, ou a pessoa não faz mais parte do clube.</p>
        <p>
          <Link to="/">← Voltar para o livro do mês</Link>
        </p>
      </div>
    </section>
  );
}

/** One past reading. `ReadingHistoryOut` carries no `id`, so the key comes from `pick.id`. */
function HistoryEntry({ reading, isMe }: { reading: ReadingHistory; isMe: boolean }) {
  const { pick } = reading;
  const pages = pick.book.pages;

  return (
    <li className="history__item">
      <div className="history__cover">
        <BookCover book={pick.book} />
      </div>

      <div className="history__text">
        <p className="muted history__month">{formatMonth(pick.month)}</p>
        <h3 className="history__title">{pick.book.title}</h3>
        <p className="muted history__author">{pick.book.author}</p>

        {/* Presence, not a score (DESIGN.md 9): what a past reading says is how far it went, in
            the member's own words — no comparison with anyone, no "did not finish" verdict. */}
        <p className="history__progress">
          {reading.finished_at
            ? "Leitura terminada."
            : reading.pages_read === 0
              ? // The row exists from the first GET of /current/reading, so a member who never
                // touched the field would otherwise read "Chegou à página 0".
                "Ainda não marcou até onde leu."
              : pages
                ? `Chegou à página ${reading.pages_read} de ${pages}.`
                : `${reading.pages_read} páginas lidas.`}
        </p>

        <StarRating value={reading.rating} label={isMe ? "Sua nota" : "Nota"} />

        {reading.review ? <p className="history__review">{reading.review}</p> : null}
      </div>
    </li>
  );
}

/**
 * `/u/:username` — a member's profile: the shelf, and every reading they have logged.
 *
 * `read_profile` is public and 404s on an inactive member, so "não existe" and "saiu do clube"
 * land on the same screen, the same way `PostDetail` treats an unpublished post.
 *
 * **There is no list of the member's posts here**, which the guide's 7.4 and this folder's
 * CLAUDE.md both expected. `GET /api/posts` takes `page` and `size` and nothing else — no author
 * filter — so the only way to build that section would be to filter a paginated feed on the
 * client, which shows "the posts of theirs that happened to land on page 1". That is worse than
 * not showing them. Both documents were corrected rather than left promising it.
 */
export function Profile() {
  const { username } = useParams<{ username: string }>();
  const me = useCurrentUser();
  const isMe = username === me.username;

  const {
    data: profile,
    isPending,
    error,
  } = useQuery({
    queryKey: ["user", username],
    queryFn: () => api<UserProfile>(`/users/${username}`),
    enabled: Boolean(username),
  });

  if (isPending) {
    return (
      <section className="section">
        <div className="container">
          <p className="muted">Carregando o perfil…</p>
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
            <span className="notice__label">Não deu para carregar o perfil.</span> {error.message}{" "}
            Recarregue a página para tentar de novo.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* The frame carries the collage; everything under it stays clean (DESIGN.md 7), and the
          wine ground is the section alternation of 3.4. */}
      <section className="section section--invert on-invert profile-header">
        <div className="container profile-header__inner">
          {profile.photo ? (
            <img
              className="profile-photo"
              src={profile.photo}
              alt={`Foto de ${profile.full_name}`}
            />
          ) : (
            <span className="profile-photo profile-photo--blank" aria-hidden="true">
              {initials(profile.full_name || profile.username)}
            </span>
          )}

          <div>
            <h1 className="profile-header__name">{profile.full_name || profile.username}</h1>
            <p className="muted profile-header__username">@{profile.username}</p>

            {profile.quote ? <p className="profile-header__quote">{profile.quote}</p> : null}

            {profile.birth_date ? (
              <p className="muted profile-header__birth">
                Faz aniversário em {formatDay(profile.birth_date)}
              </p>
            ) : null}

            {isMe ? (
              <p className="profile-header__actions">
                <Link className="button button--highlight" to="/profile/edit">
                  Editar perfil
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">{isMe ? "Sua estante" : "Estante"}</h2>
          <FavoritesShelf books={profile.favorites} canEdit={isMe} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">{isMe ? "Suas leituras" : "Leituras"}</h2>

          {profile.readings.length === 0 ? (
            <div className="state">
              <BrandElement name="nuvem" />
              <p>
                {isMe
                  ? "Você ainda não registrou nenhuma leitura. Comece pelo livro deste mês — vale marcar mesmo que sejam dez páginas."
                  : "Esta pessoa ainda não registrou nenhuma leitura."}
              </p>
              {isMe ? (
                <p>
                  <Link className="button" to="/">
                    Ir para o livro do mês
                  </Link>
                </p>
              ) : null}
            </div>
          ) : (
            <ul className="history">
              {profile.readings.map((reading) => (
                <HistoryEntry key={reading.pick.id} reading={reading} isMe={isMe} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
