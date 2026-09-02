import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api/client";
import type { MonthlyPick, MonthlyReading } from "../api/types";
import { useCurrentUser } from "../context/CurrentUser";
import { FinishedReaders } from "./FinishedReaders";
import { StarRating } from "./StarRating";

/**
 * Where you are in this month's book — the pages, the rating if you feel like giving one, and a
 * folded-away way to see who already finished it (`FinishedReaders`, which asks for its own data
 * only when opened).
 *
 * The tone here is load-bearing (DESIGN.md 9): the bar informs, it never nags. No countdown, no
 * "you're behind", no red for a low number, and the fill keeps the same colour at 8% and at 96%.
 * The rating is offered, never required, and nothing on the screen is gated behind it.
 *
 * The rating lives in this component rather than in one of its own because it is the *same row*:
 * `pages_read` and `rating` are two fields of `MonthlyReading`, written by the same
 * `PUT /monthly-picks/current/reading` and read from the same `["reading", "current"]` cache
 * entry. A separate section would fetch and invalidate the same data twice.
 *
 * The reading row is created lazily by the backend, so the GET always answers — a member who has
 * never touched progress reads 0 pages, which is a reading that has started.
 */
export function ProgressBar({ pick }: { pick: MonthlyPick }) {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  // null means "mirror whatever the server last said"; a string means the member is typing.
  const [draft, setDraft] = useState<string | null>(null);

  const { data: reading, isPending } = useQuery({
    queryKey: ["reading", "current"],
    queryFn: () => api<MonthlyReading>("/monthly-picks/current/reading"),
  });

  const save = useMutation({
    mutationFn: (pagesRead: number) =>
      api<MonthlyReading>("/monthly-picks/current/reading", {
        method: "PUT",
        body: JSON.stringify({ pages_read: pagesRead }),
      }),
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["reading", "current"] });
      // Reaching the last page is what sets `finished_at`, which is half of what puts a member
      // on the "quem já terminou" list — so that list goes stale here too.
      queryClient.invalidateQueries({ queryKey: ["readers", "current"] });
    },
  });

  /**
   * Grading and erasing are one mutation because they are one request to one row — and two
   * shapes of body, which is the API's own split. `{"rating": n}` writes a note, where 0 means
   * zero stars like any other number; `{"clear_rating": true}` takes the column back to NULL.
   *
   * A `{"rating": null}` would do neither: `update_reading` guards every field with
   * `if payload.<field> is not None`, so a null reads as "leave it alone" — which is what makes
   * a partial PUT possible and why erasing needed a field of its own. DESIGN.md 9 asks for the
   * rating to be reversible, and this is now that path.
   *
   * The number is 0 to 5 in steps of 0.5 — `multiple_of=0.5` on the schema, so a 3.3 is a 422.
   * `StarRating` only ever produces values on that grid.
   */
  const rate = useMutation({
    mutationFn: (payload: { rating: number } | { clear_rating: true }) =>
      api<MonthlyReading>("/monthly-picks/current/reading", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reading", "current"] });
      // The profile's reading history prints this rating, so it goes stale as well. And so does
      // "quem já terminou": a note is now half of what puts a member on that list, and erasing
      // one takes them off it.
      queryClient.invalidateQueries({ queryKey: ["user", me.username] });
      queryClient.invalidateQueries({ queryKey: ["readers", "current"] });
    },
  });

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
    save.mutate(pagesRead);
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

          <div className="progress__rating">
            <StarRating
              value={reading.rating}
              label="Se quiser, dê uma nota"
              // Under the bar, and only while there is no note: it is the offer, so it goes away
              // the moment the offer is taken. `StarRating` owns it because it holds the value
              // the member just clicked, which this component only sees once the PUT comes back.
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

          {/* Folded away until asked for, and inside this card rather than under it: it is about
              the book you are reading, not a section of its own (see FinishedReaders). */}
          <FinishedReaders />
        </div>
      </div>
    </section>
  );
}
