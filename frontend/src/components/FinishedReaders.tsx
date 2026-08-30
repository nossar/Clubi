import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";

import { api } from "../api/client";
import type { FinishedReader } from "../api/types";
import { useCurrentUser } from "../context/CurrentUser";
import { StarRating } from "./StarRating";

/**
 * Who already finished this month's book, and what they thought of it — **only when asked for**.
 *
 * It replaced "Quem está lendo", which was a section of its own that every visit printed whether
 * anyone wanted it or not. Two things decide the shape here:
 *
 * 1. **A disclosure, not a section.** The list belongs to the book of the month, so it lives
 *    inside the reading card rather than stacking a fourth scrollable block under it, and it
 *    stays folded until the member asks. The control is a word (DESIGN.md 6.3 / E-07), it owns
 *    `aria-expanded` and `aria-controls`, and the panel it names is in the DOM at all times so
 *    that reference never dangles.
 * 2. **The request waits for the click** (`enabled: open`). Nothing about this list is needed to
 *    read the page, so nobody pays for it until they want it — and both the wait and any failure
 *    are drawn *inside* the panel, which is why opening it can never take the reading card away.
 *
 * Still not a scoreboard (DESIGN.md 9): the API hands this list back in alphabetical order, there
 * is no club average, no count, no podium, and nothing here is comparable except by a member who
 * goes looking. The rating is the brand's own star row in read-only mode — the same drawing the
 * member rates with, so a 4 looks the same everywhere on the site.
 */
export function FinishedReaders() {
  const me = useCurrentUser();
  const panelId = useId();
  const [open, setOpen] = useState(false);

  const {
    data: readers,
    isPending,
    error,
  } = useQuery({
    queryKey: ["readers", "current"],
    queryFn: () => api<FinishedReader[]>("/monthly-picks/current/readers"),
    enabled: open,
  });

  return (
    <div className="finished">
      <button
        className="button button--quiet finished__toggle"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {open ? "Esconder quem já terminou" : "Ver quem já terminou"}
      </button>

      <div className="finished__panel" id={panelId} hidden={!open}>
        {open ? (
          <Panel readers={readers} isPending={isPending} error={error} me={me.username} />
        ) : null}
      </div>
    </div>
  );
}

function Panel({
  readers,
  isPending,
  error,
  me,
}: {
  readers: FinishedReader[] | undefined;
  isPending: boolean;
  error: Error | null;
  me: string;
}) {
  if (error) {
    return (
      <p className="notice notice--error">
        <span className="notice__label">Não deu para carregar a lista.</span> {error.message}{" "}
        Feche e abra de novo para tentar mais uma vez.
      </p>
    );
  }

  if (isPending || !readers) {
    return <p className="muted">Carregando quem já terminou…</p>;
  }

  if (readers.length === 0) {
    return (
      <p className="muted">
        Ninguém terminou ainda — ou quem terminou ainda não deu nota. Assim que alguém fechar o
        livro e deixar uma, aparece por aqui.
      </p>
    );
  }

  return (
    <ul className="finished__list">
      {readers.map((reader) => (
        <li key={reader.user.username}>
          {/* The name is the star row's label, so each line reads "★★★★☆ Ana Ribeiro: 4 de 5" —
              one element instead of a name printed twice. */}
          <StarRating
            value={reader.rating}
            label={reader.user.username === me ? "você" : reader.user.full_name}
          />
        </li>
      ))}
    </ul>
  );
}
