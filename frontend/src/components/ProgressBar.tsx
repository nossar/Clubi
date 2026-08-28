import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api/client";
import type { MonthlyPick, MonthlyReading } from "../api/types";
import { useCurrentUser } from "../context/CurrentUser";
import { StarRating } from "./StarRating";

/**
 * Where you are in this month's book — the pages, and the rating if you feel like giving one.
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
      // Saving progress is also what puts the member on the "quem está lendo" list.
      queryClient.invalidateQueries({ queryKey: ["readers", "current"] });
    },
  });

  /**
   * A rating of 0 is how the API expresses "sem nota", and the only way to clear one: the route
   * guards every field with `if payload.<field> is not None`, so `{"rating": null}` is discarded
   * in silence and the old number stays. `MonthlyReadingIn` allows `ge=0`, and the model's
   * validator allows 0 too, so 0 is a real value rather than a trick. DESIGN.md 9 requires the
   * rating to be reversible; this is the one shape that delivers it.
   */
  const rate = useMutation({
    mutationFn: (rating: number) =>
      api<MonthlyReading>("/monthly-picks/current/reading", {
        method: "PUT",
        body: JSON.stringify({ rating }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reading", "current"] });
      // The profile's reading history prints this rating, so it goes stale as well. Not
      // ["readers", "current"]: a rating does not change who is reading.
      queryClient.invalidateQueries({ queryKey: ["user", me.username] });
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

          <p className="progress__note">
            Comece por onde der: a gente não cobra ter lido o livro inteiro.
          </p>

          <div className="progress__rating">
            <StarRating
              value={reading.rating}
              label="Se quiser, dê uma nota"
              name="monthly-rating"
              onRate={(rating) => rate.mutate(rating)}
              onClear={() => rate.mutate(0)}
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

            <p className="progress__note">
              A nota é sua e dá para mudar ou tirar quando quiser. Ninguém compara notas por aqui.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
