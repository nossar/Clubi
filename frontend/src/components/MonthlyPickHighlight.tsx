import { Link } from "react-router-dom";

import type { MonthlyPick } from "../api/types";
import { formatDay, formatMonth } from "../format";
import { BookCover } from "./BookCover";
import { BrandElement } from "./BrandElement";

/**
 * The hero, and the one place on the page that carries the brand's collage language: the cover
 * pasted over an offset checkered patch, in a thick cream border with a warm shadow, with the
 * highlighter stamp tilted at its corner (DESIGN.md 7). Everything below it stays clean.
 *
 * The wine ground is the alternation of DESIGN.md 3.4 — the highlight in wine, the working
 * sections in cream.
 */
export function MonthlyPickHighlight({ pick }: { pick: MonthlyPick }) {
  const { book } = pick;

  return (
    <section className="pick section--invert on-invert">
      <div className="container">
        <p className="pick__eyebrow">
          <BrandElement name="livro-aberto" />
          {formatMonth(pick.month)}
        </p>

        <div className="pick__inner">
          <div className="pick__cutout">
            <BookCover book={book} />
            <p className="pick__stamp">livro do mês</p>
          </div>

          <div>
            <h1 className="pick__title">{book.title}</h1>
            <p className="pick__author">
              {book.author}
              {book.year ? `, ${book.year}` : ""}
            </p>

            {/* The club's own words about this month's choice come first; the publisher's
                synopsis is the fallback when the pick was registered without a blurb. */}
            {pick.blurb || book.synopsis ? (
              <p className="pick__blurb">{pick.blurb || book.synopsis}</p>
            ) : null}

            <p className="pick__dates">
              A leitura vai até {formatDay(pick.ends_on)}
              {book.pages ? ` · ${book.pages} páginas` : ""}
            </p>

            {/* The club's memory is one link away from its present (Fase 7). */}
            <p className="pick__more">
              <Link to="/book-of-the-month/history">Ver as escolhas anteriores</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
