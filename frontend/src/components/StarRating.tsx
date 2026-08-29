import { useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { BrandElement } from "./BrandElement";
import {
  MAX_RATING,
  RATING_STEP,
  STARS,
  ratingCaption,
  ratingFromPosition,
  starFill,
  stepRating,
} from "./starRating";

/**
 * The rating for one reading, drawn with the brand's own five-pointed star (DESIGN.md 6.3) — the
 * SVG paints with `currentColor`, so an unfilled star is the same artwork in `--clubi-line`
 * rather than a second file, and a *half* star is that same artwork a second time under a layer
 * clipped to 50% (DESIGN.md 8.7).
 *
 * The tone here is load-bearing (DESIGN.md 9), and this is one of the two components the document
 * warns will get it wrong. So: no club average, no "avalie para continuar", nothing that ranks one
 * member's number against another's. A rating is optional, and the star row never appears as a
 * requirement — only as an offer.
 *
 * **The scale is 0 to 5 in steps of 0.5**, which is exactly what `MonthlyReadingIn.rating` accepts;
 * anything off that grid is a 422. The column behind it stores half-stars as an integer, and that
 * is the backend's business — nothing here doubles or halves anything.
 *
 * **0 means "sem nota", and it is how a rating is cleared.** The API cannot express this any other
 * way: `update_reading` ignores `{"rating": null}` outright (`if payload.rating is not None`), so
 * a null round-trips as "leave it alone" and only `{"rating": 0}` actually writes. Rendering
 * treats `0` and `null` identically — both are "sem nota". Dragging off the left end of the bar
 * reaches 0, so the gesture can undo itself without the button.
 *
 * Interaction is one `role="slider"` driven by Pointer Events, which is one handler for mouse,
 * touch and pen. It replaced five radio inputs: half steps would have needed ten of them, and the
 * radio ring gives no way to preview a value the member has not committed to. What the radios did
 * give away for free is re-supplied deliberately — arrow keys in `onKeyDown`, the current value in
 * `aria-valuenow`/`aria-valuetext`, and a focus ring on the bar.
 */
export function StarRating({
  value,
  label,
  onRate,
  onClear,
  disabled = false,
}: {
  /** 0 to 5 in steps of 0.5, or `null` for "sem nota". */
  value: number | null;
  label: string;
  /** Omit to render a read-only row (the profile history). */
  onRate?: (rating: number) => void;
  /** Sends `{"rating": 0}`. Omit to leave the rating unclearable. */
  onClear?: () => void;
  disabled?: boolean;
}) {
  // Two rows on one screen would otherwise share the label's id and the second slider would be
  // announced with the first one's name — the same trap BookPicker's input id fell into.
  const labelId = useId();
  const serverRating = value ?? 0;

  // What the member just asked for, until the server's answer catches up. Without it, two quick
  // arrow presses would both read the same stale prop and the second would undo the first.
  const [pending, setPending] = useState<number | null>(null);
  const [lastServerRating, setLastServerRating] = useState(serverRating);
  if (serverRating !== lastServerRating) {
    setLastServerRating(serverRating);
    setPending(null);
  }

  // What the pointer is over, before it is committed. Distinct from `pending`: a preview is a
  // question, and it is drawn differently (DESIGN.md 8.7) so nobody mistakes it for their note.
  const [preview, setPreview] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  // The value the pointer-down already sent, so the pointer-up does not re-send an unchanged one.
  const sent = useRef<number | null>(null);

  const rating = pending ?? serverRating;
  const shown = preview ?? rating;

  if (!onRate) {
    return (
      <p className="star-rating star-rating--static">
        <Stars value={rating} />
        <span className="star-rating__caption">
          {label}: {ratingCaption(rating)}
        </span>
      </p>
    );
  }

  function commit(next: number) {
    setPending(next);
    sent.current = next;
    onRate?.(next);
  }

  /** The button, not the drag: it goes through `onClear` so the caller keeps owning the request. */
  function clear() {
    setPending(0);
    sent.current = 0;
    onClear?.();
  }

  function valueAt(event: PointerEvent<HTMLDivElement>) {
    const bar = event.currentTarget.getBoundingClientRect();
    return ratingFromPosition(event.clientX - bar.left, bar.width);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    // Capture keeps the drag alive past the ends of the bar and past the edge of the window;
    // without it, dragging to 5 by overshooting would drop the pointer on the way out.
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    setDragging(true);

    const next = valueAt(event);
    setPreview(next);
    commit(next);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    // A finger that is not pressing is not hovering — it is somewhere else entirely.
    if (!dragging && event.pointerType !== "mouse") return;
    setPreview(valueAt(event));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragging(false);
    setPreview(null);

    const next = valueAt(event);
    if (next !== sent.current) commit(next);
  }

  function onPointerCancel() {
    setDragging(false);
    setPreview(null);
  }

  function onPointerLeave() {
    if (!dragging) setPreview(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;

    const next = keyboardRating(event.key, rating);
    if (next === null) return;

    // The arrows and Home/End would otherwise scroll the page under the widget.
    event.preventDefault();
    setPreview(null);
    if (next !== rating) commit(next);
  }

  return (
    <div className="star-rating">
      <span className="field-label" id={labelId}>
        {label}
      </span>

      <div
        className={previewing(preview) ? "star-rating__bar is-preview" : "star-rating__bar"}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={MAX_RATING}
        // A drag is the member moving the control, so the value follows the finger. A mouse
        // merely hovering is not, and announcing every star it crosses would be noise.
        aria-valuenow={dragging ? shown : rating}
        aria-valuetext={ratingCaption(dragging ? shown : rating)}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        <Stars value={shown} />
      </div>

      <p className="star-rating__caption">
        {previewing(preview) ? `prévia: ${ratingCaption(preview)}` : ratingCaption(rating)}
        {onClear && rating > 0 ? (
          <>
            {" · "}
            <button
              className="button button--quiet"
              type="button"
              onClick={clear}
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

function previewing(preview: number | null): preview is number {
  return preview !== null;
}

/**
 * The row itself. Every star is two copies of the same drawing: the empty one in `--clubi-line`,
 * and a filled one on top inside a box clipped to 0%, 50% or 100% of its width.
 *
 * There is no element per half and no gap between stars — the value comes from the bar's own
 * rectangle, so the whole row is one continuous surface and the nearest half is always the one
 * under the finger. Each star is a 44px target (DESIGN.md 10.4) around a 1.5rem glyph, which
 * leaves 22px of slack for each half.
 */
function Stars({ value }: { value: number }) {
  return (
    <span className="star-rating__stars" aria-hidden="true">
      {STARS.map((star) => {
        const fill = starFill(value, star);
        return (
          <span
            key={star}
            className={
              fill === 1
                ? "star-rating__star is-on"
                : fill === 0.5
                  ? "star-rating__star is-half"
                  : "star-rating__star"
            }
          >
            <span className="star-rating__glyphs">
              <BrandElement name="estrela-5" />
              <span className="star-rating__fill">
                <BrandElement name="estrela-5" />
              </span>
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * The APG slider keys: arrows by half a star, PageUp/PageDown by a whole one, Home to "sem nota"
 * and End to 5. `null` means the key was not ours and the browser keeps it.
 */
function keyboardRating(key: string, rating: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return stepRating(rating, RATING_STEP);
    case "ArrowLeft":
    case "ArrowDown":
      return stepRating(rating, -RATING_STEP);
    case "PageUp":
      return stepRating(rating, 1);
    case "PageDown":
      return stepRating(rating, -1);
    case "Home":
      return 0;
    case "End":
      return MAX_RATING;
    default:
      return null;
  }
}
