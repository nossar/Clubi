import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api/client";
import type { MonthlyPick, MonthlyReading } from "../api/types";
import { useWriteReading } from "../reading";
import { ReadingReview } from "./ReadingReview";
import { StarRating } from "./StarRating";

/**
 * Where you are in this month's book — the pages, whether you have closed it, and the rating and
 * the resenha if you feel like leaving them. Everything on this card is *yours*: what other
 * members thought moved out to `/book-of-the-month/readers`, reached from the hero, so that the
 * screen where you log your own pages never prints anybody else's note beside them.
 *
 * The tone here is load-bearing (DESIGN.md 9): the bar informs, it never nags. No countdown, no
 * "you're behind", no red for a low number, and the fill keeps the same colour at 8% and at 96%.
 * The rating is offered, never required, and no part of the reading is gated behind *giving* one.
 *
 * **While the reading is open, the card is the bar and the page field and nothing else.** The nota
 * and the resenha arrive with `finished_at` — see the gate further down for what that stamp is and
 * is not.
 *
 * **The rating block is the one wine panel inside a cream section**, and it is doing a job the
 * hairlines could not: four stacked text blocks on one ground read as one undifferentiated column,
 * and the yellow stars the invert already gives (`.on-invert .star-rating__fill`) are the site's
 * own pairing for that ground. DESIGN.md 3.4 is amended for it — the alternation was written as a
 * page-level rhythm, and this is the single block-level exception it now names.
 *
 * Everything on this screen writes the *same row*: `pages_read`, `finished_at`, `rating` and
 * `review` are four fields of one `MonthlyReading`, written by one partial
 * `PUT /monthly-picks/current/reading` and read from one `["reading", "current"]` cache entry.
 * That is why this component fetches once and hands the result down (`ReadingReview` takes a
 * prop, it does not fetch), and why every write goes through `useWriteReading` — the list of
 * caches that go stale is a property of the row, not of the control that moved it.
 *
 * **"Terminei este livro" is a control and not a readout.** Reaching the last page still marks a
 * reading finished, but that inference needs `Book.pages`, which is nullable — for a pick with no
 * page count it can never fire, and a member reading one could not finish, could not appear on
 * "quem já terminou" and never saw the resenha invited. The declaration is also reversible, which
 * the inference was not: a mis-tapped page number used to close the book for good.
 *
 * The reading row is created lazily by the backend, so the GET always answers — a member who has
 * never touched progress reads 0 pages, which is a reading that has started.
 */
export function ProgressBar({ pick }: { pick: MonthlyPick }) {
  // null means "mirror whatever the server last said"; a string means the member is typing.
  const [draft, setDraft] = useState<string | null>(null);

  const { data: reading, isPending } = useQuery({
    queryKey: ["reading", "current"],
    queryFn: () => api<MonthlyReading>("/monthly-picks/current/reading"),
  });

  // Three instances of one hook, not one shared between three controls: `isPending` and `error`
  // belong to a mutation, and sharing would have printed a failed rating under the pages field.
  const save = useWriteReading(() => setDraft(null));
  const finish = useWriteReading();

  /**
   * Grading and erasing are one instance because they are one request to one row — and two shapes
   * of body, which is the API's own split. `{"rating": n}` writes a note, where 0 means zero stars
   * like any other number; `{"clear_rating": true}` takes the column back to NULL.
   *
   * A `{"rating": null}` would do neither: `update_reading` guards every field with
   * `if payload.<field> is not None`, so a null reads as "leave it alone" — which is what makes
   * a partial PUT possible and why erasing needed a field of its own. DESIGN.md 9 asks for the
   * rating to be reversible, and this is now that path.
   *
   * The number is 0 to 5 in steps of 0.5 — `multiple_of=0.5` on the schema, so a 3.3 is a 422.
   * `StarRating` only ever produces values on that grid.
   */
  const rate = useWriteReading();

  if (isPending || !reading) {
    return (
      <section className="section">
        <div className="container">
          <p className="muted">Carregando a sua leitura…</p>
        </div>
      </section>
    );
  }

  const total = pick.book.pages ?? null;
  const percent = reading.percent ?? 0;
  const value = draft ?? String(reading.pages_read);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pagesRead = Number(value);
    if (!Number.isInteger(pagesRead) || pagesRead < 0) return;
    save.mutate({ pages_read: pagesRead });
  }

  return (
    <section className="section">
      <div className="container">
        <h2 className="section-title">Onde você está</h2>

        <div className="progress">
          {total ? (
            <>
              <div
                className="progress__track"
                role="progressbar"
                aria-label="Sua leitura deste mês"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={reading.pages_read}
                aria-valuetext={`${reading.pages_read} de ${total} páginas`}
              >
                <div className="progress__fill" style={{ width: `${percent}%` }} />
              </div>
              <p className="progress__readout">
                <strong>{reading.pages_read}</strong> de {total} páginas · {percent}%
              </p>
            </>
          ) : (
            // percent is null when the book has no page count, and a bar without a total would
            // be a made-up number.
            <p className="progress__readout">
              <strong>{reading.pages_read}</strong> páginas lidas
            </p>
          )}

          <form className="progress__form" onSubmit={onSubmit}>
            <label className="field-label" htmlFor="pages-read">
              Até que página você chegou?
            </label>
            <div className="progress__row">
              <input
                className="field-number"
                id="pages-read"
                name="pages-read"
                type="number"
                inputMode="numeric"
                min={0}
                max={total ?? undefined}
                value={value}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button className="button" type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>

          <div aria-live="polite">
            {save.isError ? (
              <p className="notice notice--error">
                <span className="notice__label">Não deu para salvar.</span>{" "}
                {save.error.message} Ajuste o número e tente de novo.
              </p>
            ) : null}
            {save.isSuccess ? (
              <p className="notice notice--ok">
                <span className="notice__label">Progresso salvo.</span> Boa leitura.
              </p>
            ) : null}
          </div>

          {/* The declaration, next to the pages it is usually read off — a statement of fact with
              a way back, never a target to hit.

              Finishing a book that *has* a page count is sent as the last page rather than as
              `finished`, and that is not a detour: reaching the last page is what the backend
              already turns into `finished_at`, and it is the only way the bar above and this
              line can agree. Declaring the reading over while the bar sat at 28% was the one
              contradiction this control introduced — before it existed, finished always meant
              100%. Only a pick with no page count (`Book.pages` is nullable) has nothing to
              write, and that is exactly the case `finished` was added for. */}
          <div className="progress__finish">
            {reading.finished_at ? (
              <>
                <p className="progress__finished">Leitura terminada.</p>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => finish.mutate({ finished: false })}
                  disabled={finish.isPending}
                >
                  {finish.isPending ? "Salvando…" : "Ainda não terminei"}
                </button>
              </>
            ) : (
              <button
                className="button button--quiet"
                type="button"
                onClick={() =>
                  finish.mutate(total ? { pages_read: total } : { finished: true })
                }
                disabled={finish.isPending}
              >
                {finish.isPending ? "Salvando…" : "Terminei este livro"}
              </button>
            )}
          </div>

          <div aria-live="polite">
            {finish.isError ? (
              <p className="notice notice--error">
                <span className="notice__label">Não deu para salvar.</span>{" "}
                {finish.error.message} Tente de novo.
              </p>
            ) : null}
          </div>

          {/* Nota and resenha appear once the reading is declared over, and not before — so a
              member still reading sees the bar, the page field and nothing else.

              What the gate is matters more than that there is one. It is `finished_at`, which
              "Terminei este livro" above sets at **any** progress — not the page count. Nobody
              has to reach page N of N to be offered the fields, which is what DESIGN.md 9 and
              the brandbook's "a gente não te cobra ter lido o livro inteiro" actually forbid;
              what is asked for is the one word that makes an opinion an opinion about a book
              you closed. The cost is real and recorded in 9: someone who stopped at 60% and
              wants to say why has no place to say it, short of claiming they finished.

              Hiding is not erasing. A note and a resenha written before "Ainda não terminei"
              stay on the row and come back the moment the reading is declared over again —
              which is also exactly when they go back to being visible to the club, since
              `finished_readers` filters on the same stamp. */}
          {reading.finished_at ? (
            <>
              {/* on-invert is not decoration here: it is the switch every child reads to repaint
                  itself for a wine ground — the star fill turns yellow, the caption and the empty
                  stars take the on-invert inks, and "Remover nota" stops being wine on wine. */}
              <div className="progress__rating on-invert">
                <StarRating
                  value={reading.rating}
                  label="Se quiser, dê uma nota"
                  // Under the bar, and only while there is no note: it is the offer, so it goes
                  // away the moment the offer is taken. `StarRating` owns it because it holds the
                  // value the member just clicked, which this component only sees once the PUT
                  // comes back.
                  hint="Altere quando quiser"
                  onRate={(rating) => rate.mutate({ rating })}
                  onClear={() => rate.mutate({ clear_rating: true })}
                  disabled={rate.isPending}
                />

                <div aria-live="polite">
                  {rate.isError ? (
                    <p className="notice notice--error">
                      <span className="notice__label">Não deu para salvar a nota.</span>{" "}
                      {rate.error.message} Tente de novo.
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Takes the row as a prop rather than fetching it: one GET feeds this whole card. */}
              <ReadingReview reading={reading} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
