import { useQuery } from "@tanstack/react-query";

import { api } from "../api/client";
import type { Reader, User } from "../api/types";
import { useCurrentUser } from "../context/CurrentUser";
import { initials } from "../format";

type Companion = Pick<User, "username" | "full_name" | "photo">;

/**
 * Who else is reading this month's book — presence, not a scoreboard (DESIGN.md 9).
 *
 * Three consequences you can read in the code. The list shows names only: the endpoint returns
 * pages_read per member, and printing that in a column is how a companionship list turns into a
 * ranking. The order is alphabetical, not the "-pages_read" the API sorts by (books/api.py) —
 * that ordering is fine for the backend, but surfacing it as-is would be the leaderboard the club
 * defines itself against. And you are always on the list: the backend creates your reading row
 * lazily, on the first GET of /current/reading, so on a first visit this request can be answered
 * a moment before that row exists. You are reading along either way.
 */
export function ReadersList() {
  const me = useCurrentUser();
  const {
    data: readers,
    isPending,
    error,
  } = useQuery({
    queryKey: ["readers", "current"],
    queryFn: () => api<Reader[]>("/monthly-picks/current/readers"),
  });

  if (isPending) {
    return (
      <section className="section">
        <div className="container">
          <p className="muted">Carregando quem está lendo…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <p className="notice notice--error">
            <span className="notice__label">Não deu para carregar a lista.</span> {error.message}
          </p>
        </div>
      </section>
    );
  }

  const companions: Companion[] = readers.map((reader) => reader.user);
  if (!companions.some((person) => person.username === me.username)) {
    companions.push(me);
  }
  companions.sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

  return (
    <section className="section">
      <div className="container">
        <h2 className="section-title">Quem está lendo</h2>

        <ul className="readers__list">
          {companions.map((person) => {
            const isMe = person.username === me.username;
            return (
              <li className={isMe ? "reader reader--me" : "reader"} key={person.username}>
                {person.photo ? (
                  <img className="avatar" src={person.photo} alt="" width={44} height={44} />
                ) : (
                  <span className="avatar" aria-hidden="true">
                    {initials(person.full_name || person.username)}
                  </span>
                )}
                <span>{isMe ? "você" : person.full_name}</span>
              </li>
            );
          })}
        </ul>

        {companions.length === 1 ? (
          <p className="progress__note">
            Por enquanto, só você. Chame alguém do clube para ler junto.
          </p>
        ) : null}
      </div>
    </section>
  );
}
