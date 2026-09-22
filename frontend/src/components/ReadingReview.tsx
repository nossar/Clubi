import { useId, useState } from "react";
import type { FormEvent } from "react";

import type { MonthlyReading } from "../api/types";
import { REVIEW_MAX_LENGTH, useWriteReading } from "../reading";

/** Below this many characters left, the field starts saying so — and not a character earlier. */
const COUNTDOWN_FROM = 200;

/**
 * The member's own resenha for this month's book: write it, edit it, erase it.
 *
 * **This component only renders for a reading that has been declared over** (`ProgressBar` holds
 * the gate, and its comment holds the argument). So everything here may assume `finished_at`: the
 * help text names "quem já terminou" as somewhere the resenha already goes rather than somewhere
 * it will go later.
 *
 * The gate is the declaration, never the page count — "Terminei este livro" is available at any
 * progress. That distinction is the whole reason this is not the thing DESIGN.md 9 forbids, and
 * the day someone moves the gate to `pages_read >= total` it becomes exactly that thing.
 *
 * **Erasing is `{"review": ""}`, not a field of its own.** The rating needed `clear_rating`
 * because `0` is a real note; an empty resenha is no resenha, so the empty string is free to be
 * the erasure (see `reading.ts`).
 *
 * Deleting goes through an inline confirmation rather than `window.confirm` — a browser dialog is
 * neither in Portuguese by our choosing nor in the brand's voice — and it is the same panel the
 * feed uses to delete a postagem.
 */
export function ReadingReview({ reading }: { reading: MonthlyReading }) {
  const fieldId = useId();
  // `null` means "not editing". An empty string is a legitimate draft — it is what the member is
  // left holding after selecting everything and deleting — so the two cannot be the same state.
  const [draft, setDraft] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const write = useWriteReading(() => {
    setDraft(null);
    setConfirming(false);
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = (draft ?? "").trim();
    // Nothing moved: close the form instead of writing what is already stored.
    if (text === reading.review) {
      setDraft(null);
      return;
    }
    write.mutate({ review: text });
  }

  const failure = write.isError ? (
    <p className="notice notice--error">
      <span className="notice__label">Não deu para salvar a resenha.</span>{" "}
      {write.error.message} Tente de novo.
    </p>
  ) : null;

  if (draft !== null) {
    const left = REVIEW_MAX_LENGTH - draft.length;

    return (
      <div className="reading-review">
        <form className="reading-review__form" onSubmit={onSubmit}>
          <label className="field-label" htmlFor={fieldId}>
            {reading.review ? "Sua resenha" : "Escreva a sua resenha"}
          </label>
          <textarea
            id={fieldId}
            className="field-textarea"
            value={draft}
            maxLength={REVIEW_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="O que ficou do livro para você?"
            aria-describedby={`${fieldId}-help`}
            autoFocus
          />
          {/* Who reads this was worth saying out loud: until the SPA grew this field, the resenha
              only ever surfaced on a profile nobody was told about. One wording, present tense,
              because a reading that reaches this component has already been declared over. */}
          <p className="muted field-help" id={`${fieldId}-help`}>
            Quem é do clubi lê: a resenha aparece no seu perfil e em “quem já terminou”.
          </p>
          {/* A character count is a number about the text, not about the member — so it appears
              only when it is about to matter, and never as a running tally of how much they have
              written (DESIGN.md 9).

              It is `aria-hidden`, and the live region below carries only the moment the field
              stops accepting input. A polite region on the count itself would announce a new
              number on each of the last two hundred keystrokes, which is not a warning — it is
              a reader talking over the writer. The textarea's own `maxLength` is what tells
              assistive tech the field is bounded. */}
          {left <= COUNTDOWN_FROM ? (
            <p className="field-help" aria-hidden="true">
              {left === 0
                ? "Você chegou ao limite de caracteres."
                : `Falta${left === 1 ? "" : "m"} ${left} caractere${left === 1 ? "" : "s"}.`}
            </p>
          ) : null}
          <span className="visually-hidden" aria-live="polite">
            {left === 0 ? "Você chegou ao limite de caracteres." : ""}
          </span>

          <div aria-live="polite">{failure}</div>

          <div className="reading-review__actions">
            <button className="button" type="submit" disabled={write.isPending}>
              {write.isPending ? "Salvando…" : "Salvar resenha"}
            </button>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setDraft(null)}
              disabled={write.isPending}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (reading.review) {
    return (
      <div className="reading-review">
        <span className="field-label">Sua resenha</span>
        <p className="reading-review__text">{reading.review}</p>

        {confirming ? (
          <div className="reading-review__confirm" aria-live="polite">
            <p className="reading-review__confirm-text">
              Apagar a sua resenha? Ela sai do seu perfil e de “quem já terminou”.
            </p>
            <div className="reading-review__actions">
              <button
                className="button"
                type="button"
                onClick={() => write.mutate({ review: "" })}
                disabled={write.isPending}
              >
                {write.isPending ? "Apagando…" : "Confirmar"}
              </button>
              <button
                className="button button--quiet"
                type="button"
                onClick={() => setConfirming(false)}
                disabled={write.isPending}
              >
                Cancelar
              </button>
            </div>
            {failure}
          </div>
        ) : (
          <div className="reading-review__actions">
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setDraft(reading.review)}
            >
              Editar resenha
            </button>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setConfirming(true)}
            >
              Apagar resenha
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="reading-review">
      {/* No longer behind a check: this whole component is. */}
      <p className="reading-review__invite">Conte o que achou!</p>
      <button className="button button--quiet" type="button" onClick={() => setDraft("")}>
        Escrever uma resenha
      </button>
    </div>
  );
}
