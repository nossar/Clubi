import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import type { MonthlyPick } from "../api/types";
import { BookCover } from "../components/BookCover";
import { BrandElement } from "../components/BrandElement";
import { formatMonth } from "../format";

/**
 * Today as `YYYY-MM-DD` in the member's own timezone.
 *
 * `MonthlyPick.starts_on`/`ends_on` are plain dates, so comparing them as ISO strings is exact —
 * and it avoids `new Date("2026-08-01")`, which parses as UTC midnight and lands on 31 July in
 * America/São_Paulo (the same trap `parseApiDate` exists for).
 */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * `/book-of-the-month/history` — every book the club has picked, newest first.
 *
 * It is the one screen for `GET /api/monthly-picks`, which nothing else called: the Home shows
 * the current pick and a profile shows *your* readings, so without this the club's own memory
 * had no page. `MonthlyPick.Meta.ordering` is `-month`, so the order arrives correct.
 *
 * Read-only, so the key is never invalidated: picks are elected in the Admin (ADR-14), not here.
 *
 * The row is deliberately the same shape as a profile's reading history — a 5rem cover beside
 * the text (E-13) — because a past month is a thumbnail, never a second hero.
 */
export function PickHistory() {
  const { data: picks, isPending, error } = useQuery({
    queryKey: ["monthly-picks"],
    queryFn: () => api<MonthlyPick[]>("/monthly-picks"),
  });

  const today = todayIso();

  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title">
          <BrandElement name="livro-fechado" />
          As escolhas do clubi
        </h1>

        {isPending ? <p className="muted search__results">Carregando as escolhas…</p> : null}

        {error ? (
          <p className="notice notice--error search__results">
            <span className="notice__label">Não deu para carregar o histórico.</span>{" "}
            {error.message} Recarregue a página para tentar de novo.
          </p>
        ) : null}

        {picks && picks.length === 0 ? (
          <div className="state search__results">
            <BrandElement name="nuvem" />
            <h2 className="state__title">ainda não há escolhas para lembrar</h2>
            <p>
              O primeiro livro do mês ainda vai sair. Quando sair, ele aparece aqui — e continua
              aqui depois que o mês virar.
            </p>
          </div>
        ) : null}

        {picks && picks.length > 0 ? (
          <ul className="history search__results">
            {picks.map((pick) => {
              const isCurrent = pick.starts_on <= today && today <= pick.ends_on;

              return (
                <li className="history__item" key={pick.id}>
                  <div className="history__cover">
                    <BookCover book={pick.book} />
                  </div>

                  <div className="history__text">
                    <p className="muted history__month">
                      {formatMonth(pick.month)}
                      {isCurrent ? <span className="pick-badge">lendo agora</span> : null}
                    </p>
                    <h2 className="history__title">{pick.book.title}</h2>
                    <p className="muted history__author">
                      {pick.book.author}
                      {pick.book.year ? `, ${pick.book.year}` : ""}
                    </p>

                    {pick.blurb || pick.book.synopsis ? (
                      <p>{pick.blurb || pick.book.synopsis}</p>
                    ) : null}

                    {isCurrent ? <Link to="/">Ver o livro do mês</Link> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
