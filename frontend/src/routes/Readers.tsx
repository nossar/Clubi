import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, api } from "../api/client";
import type { FinishedReader, MonthlyPick } from "../api/types";
import { BrandElement } from "../components/BrandElement";
import { StarRating } from "../components/StarRating";
import { useCurrentUser } from "../context/CurrentUser";

/**
 * `/book-of-the-month/readers` — who finished this month's book, and what they said about it.
 *
 * It was a disclosure folded inside the reading card (`FinishedReaders`), and the move up to a
 * screen of its own is the one thing here worth arguing about. DESIGN.md 9 asked for it folded,
 * in those words, because "uma lista de notas que o membro não pediu para ver é outra coisa" —
 * and it still calls this list the closest the site comes to the ranking culture the club
 * defines itself against. What made a page defensible is that the *asking* survived intact: the
 * list is behind a named link in the hero, nothing on the Home prints it or counts it, and a
 * member who never follows the link never sees a note that is not their own. What a page buys is
 * the room the resenhas started needing — inside an 18rem panel they were a two-and-a-half-person
 * window — and it takes the club's longest writing off the screen where each member is logging
 * their own pages.
 *
 * The guardrails did not move and must not: **alphabetical** (the API orders by `full_name`, never
 * by note and never by who finished first), no club average, no count of how many finished, no
 * podium, no "você está atrás". If a sort control or a total ever seems like an improvement here,
 * it is the thing DESIGN.md 9 exists to refuse.
 *
 * Two requests, both cheap: the pick for the book's name in the heading, and the readers. The pick
 * is almost certainly already in the cache under the same key the Home uses.
 */
export function Readers() {
  const me = useCurrentUser();

  const { data: pick, error: pickError } = useQuery({
    queryKey: ["monthly-pick", "current"],
    queryFn: () => api<MonthlyPick>("/monthly-picks/current"),
  });

  const {
    data: readers,
    isPending,
    error,
  } = useQuery({
    queryKey: ["readers", "current"],
    queryFn: () => api<FinishedReader[]>("/monthly-picks/current/readers"),
  });

  // Both endpoints 404 for the same reason — there is no pick this month — so the screen says
  // that once instead of printing an error for a state that is not a fault.
  const noPick =
    (pickError instanceof ApiError && pickError.status === 404) ||
    (error instanceof ApiError && error.status === 404);

  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title">
          <BrandElement name="estrela-5" />
          Quem já terminou
        </h1>

        {noPick ? (
          <div className="state search__results">
            <h2 className="state__title">ainda não há livro do mês</h2>
            <p>Quando a escolha sair, é aqui que as leituras terminadas aparecem.</p>
            <p>
              <Link to="/">← Voltar para o livro do mês</Link>
            </p>
          </div>
        ) : (
          <>
            {pick && readers && readers.length > 0 ? (
              <p className="readers__intro muted">
                O que o clubi achou de <strong>{pick.book.title}</strong>.
              </p>
            ) : null}

            {isPending ? <p className="muted search__results">Carregando…</p> : null}

            {error && !noPick ? (
              <p className="notice notice--error search__results">
                <span className="notice__label">Não deu para carregar a lista.</span>{" "}
                {error.message} Recarregue a página para tentar de novo.
              </p>
            ) : null}

            {readers && readers.length === 0 ? (
              <div className="state search__results">
                <BrandElement name="nuvem" />
                <h2 className="state__title">ninguém terminou ainda</h2>
                <p>
                  Ou quem terminou ainda não deu nota nem escreveu resenha. Assim que alguém
                  fechar o livro e deixar uma das duas, aparece por aqui.
                </p>
                <p>
                  <Link to="/">← Voltar para o livro do mês</Link>
                </p>
              </div>
            ) : null}

            {readers && readers.length > 0 ? (
              <>
                <ul className="readers search__results">
                  {readers.map((reader) => {
                    const isMe = reader.user.username === me.username;
                    const name = isMe ? "você" : reader.user.full_name;

                    return (
                      <li className="readers__item" key={reader.user.username}>
                        {/* With a note, the name is the star row's label, so the line reads
                            "★★★★☆ Ana Ribeiro: 4 de 5" — one element instead of a name printed
                            twice.

                            Without one, the stars go away entirely rather than drawing five empty
                            ones. An unfilled row beside a name reads as zero stars, and zero is a
                            rating the backend spent a whole field separating from "sem nota"
                            (`clear_rating`); redrawing them identically here would give that
                            distinction away on the one screen where both appear side by side. The
                            absence of the row *is* the "sem nota". */}
                        {reader.rating === null ? (
                          <p className="readers__name">{name}</p>
                        ) : (
                          <StarRating value={reader.rating} label={name} />
                        )}

                        {reader.review ? (
                          <ReaderReview
                            text={reader.review}
                            whose={isMe ? "a sua resenha" : `a resenha de ${reader.user.full_name}`}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                <p className="readers__back">
                  <Link to="/">← Voltar para o livro do mês</Link>
                </p>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * One member's resenha: the first few lines, and a way to the rest *only when there is a rest*.
 *
 * The alternative was a "Ver a resenha" button on every line, which is what this feature was
 * first sketched as. It charges a click for two lines of text, and on a screen that exists to be
 * read it would have made the reading the exception. So the resenha is simply there, clamped, and
 * the control appears only for the ones long enough to need it.
 *
 * How many lines survive the clamp is `.readers__review.is-clamped`'s business and stays in the
 * stylesheet; whether the text outruns them is a question only the browser can answer, since it
 * depends on the font, the width and where the words break. So it is measured rather than guessed
 * from a character count, and re-measured when the column reflows. Two details keep that honest:
 *
 * - the measurement is skipped while expanded, because an expanded node always reports that it
 *   fits, and that would have taken away the "Mostrar menos" the member just used;
 * - `overflows` starting `false` means the control appears a frame late rather than flashing on
 *   a resenha that turns out to fit.
 *
 * The accessible name carries whose resenha it is — a list of ten would otherwise offer ten
 * controls called "Ler tudo" (DESIGN.md 6.3, and the same trap `PostCard` names its buttons for).
 */
function ReaderReview({ text, whose }: { text: string; whose: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const node = textRef.current;
    if (!node || expanded) return;

    const measure = () => setOverflows(node.scrollHeight - node.clientHeight > 1);
    measure();

    // The card reflows with the viewport, so a resenha that fits on a desktop may not fit once
    // the column narrows.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <>
      <p ref={textRef} className={expanded ? "readers__review" : "readers__review is-clamped"}>
        {text}
      </p>
      {overflows ? (
        <button
          className="button button--quiet"
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? `Mostrar menos de ${whose}` : `Ler ${whose} inteira`}
          onClick={() => setExpanded((wasExpanded) => !wasExpanded)}
        >
          {expanded ? "Mostrar menos" : "Ler tudo"}
        </button>
      ) : null}
    </>
  );
}
