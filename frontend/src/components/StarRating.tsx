import { BrandElement } from "./BrandElement";

const STARS = [1, 2, 3, 4, 5];

/**
 * The rating for one reading, drawn with the brand's own five-pointed star (DESIGN.md 6.3) — the
 * SVG paints with `currentColor`, so an unfilled star is the same artwork in `--clubi-line`
 * rather than a second file.
 *
 * The tone here is load-bearing (DESIGN.md 9), and this is one of the two components the document
 * warns will get it wrong. So: no club average, no "avalie para continuar", nothing that ranks one
 * member's number against another's. A rating is optional, and the star row never appears as a
 * requirement — only as an offer.
 *
 * **0 means "sem nota", and it is how a rating is cleared.** The API cannot express this any other
 * way: `update_reading` ignores `{"rating": null}` outright (`if payload.rating is not None`), so
 * a null round-trips as "leave it alone" and only `{"rating": 0}` actually writes. The model
 * allows 0 (`MinValueValidator(0)`), which is what makes it usable as the empty value. Rendering
 * treats `0` and `null` identically — both are "sem nota".
 *
 * Interactive mode uses real radio inputs, visually replaced by the stars: that is what gives
 * arrow-key navigation and the checked state for free. Each label is a 44px touch target
 * (DESIGN.md 10.4), which the stars are explicitly named as a candidate to get wrong.
 */
export function StarRating({
  value,
  label,
  name,
  onRate,
  onClear,
  disabled = false,
}: {
  /** 1–5, or `0`/`null` for "sem nota". */
  value: number | null;
  label: string;
  /** Radio group name — required when the row is interactive, so two rows never share a group. */
  name?: string;
  /** Omit to render a read-only row (the profile history). */
  onRate?: (rating: number) => void;
  /** Sends `{"rating": 0}`. Omit to leave the rating unclearable. */
  onClear?: () => void;
  disabled?: boolean;
}) {
  const rating = value ?? 0;
  const caption = rating > 0 ? `${rating} de 5` : "sem nota";

  if (!onRate) {
    return (
      <p className="star-rating star-rating--static">
        <span className="star-rating__stars" aria-hidden="true">
          {STARS.map((star) => (
            <span
              key={star}
              className={star <= rating ? "star-rating__star is-on" : "star-rating__star"}
            >
              <BrandElement name="estrela-5" />
            </span>
          ))}
        </span>
        <span className="star-rating__caption">
          {label}: {caption}
        </span>
      </p>
    );
  }

  return (
    <div className="star-rating">
      <fieldset className="star-rating__group" disabled={disabled}>
        <legend className="field-label">{label}</legend>
        <div className="star-rating__stars">
          {STARS.map((star) => (
            <label
              key={star}
              className={star <= rating ? "star-rating__star is-on" : "star-rating__star"}
            >
              <input
                className="star-rating__input"
                type="radio"
                name={name}
                value={star}
                checked={star === rating}
                onChange={() => onRate(star)}
              />
              <BrandElement name="estrela-5" />
              <span className="visually-hidden">
                {star === 1 ? "1 estrela" : `${star} estrelas`}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="star-rating__caption">
        {caption}
        {onClear && rating > 0 ? (
          <>
            {" · "}
            <button
              className="button button--quiet"
              type="button"
              onClick={onClear}
              disabled={disabled}
            >
              Tirar a nota
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
