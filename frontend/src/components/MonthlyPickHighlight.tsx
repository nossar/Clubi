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

            {/* The two ways out of this month, both yellow on the wine ground (3.2 measures
                that pair at 6.84 and it is the only background yellow is allowed on).

                "Quem já terminou" comes first because it is about *this* book; the history is
                the club's memory, which is elsewhere by definition. It used to be a disclosure
                folded into the reading card below, and moving it up here is what took the
                club's longest writing off the screen where each member logs their own pages —
                without making it something anyone is shown unasked (routes/Readers). No count
                beside it, deliberately: a number here would be the scoreboard DESIGN.md 9
                refuses, and it would cost a request the hero does not otherwise make. */}
            <p className="pick__more">
              <Link to="/book-of-the-month/readers">Ver quem já terminou</Link>
              {/* A separator, not a control and not a bullet anyone should hear: two underlined
                  phrases side by side read as one long link at a glance, and the gap alone was
                  not saying where the first one ends. aria-hidden keeps it out of the sentence a
                  screen reader builds — the two links are already two stops. */}
              <span className="pick__more-dot" aria-hidden="true" />
              <Link to="/book-of-the-month/history">Ver as escolhas anteriores</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
