/* The geometry and arithmetic behind `StarRating`, kept out of the component so it can be tested
 * without a DOM: everything here is a pure function of a number.
 *
 * The scale is the API's — 0 to 5 in steps of 0.5 (`MonthlyReadingIn.rating`). The backend stores
 * twice that in an integer column; nothing on this side ever sees it, and nothing here should
 * learn about it. */

export const MAX_RATING = 5;
export const RATING_STEP = 0.5;

/** The five stars, 1-based — the same list the component maps over. */
export const STARS = [1, 2, 3, 4, 5];

export function clampRating(value: number): number {
  return Math.min(MAX_RATING, Math.max(0, value));
}

/**
 * The rating under a pointer at `x` pixels from the left edge of a bar `barWidth` wide.
 *
 * **Convention: the left half of a star fills *that* star halfway; it does not complete the one
 * before it.** So anywhere in the left half of the third star is 2.5 and anywhere in its right
 * half is 3 — which is what makes the drawing agree with the cursor, since the star being painted
 * half full is always the one under the finger.
 *
 * Two edges the formula alone does not give:
 * - `x < 0` is 0 — **zero stars, which is a rating**, not "sem nota". Dragging off the left end
 *   is how a member gives a book nothing; without it the lowest reachable value would be 0.5
 *   (`Math.floor` of a tiny x is still star 1). Erasing a note is a separate control, because
 *   the API separates them (`MonthlyReadingIn.clear_rating`).
 * - past the right end clamps to 5, so overshooting a drag does not wrap or overflow.
 */
export function ratingFromPosition(x: number, barWidth: number, stars = MAX_RATING): number {
  const starWidth = barWidth / stars;
  if (!Number.isFinite(starWidth) || starWidth <= 0) return 0;
  if (x < 0) return 0;

  const star = Math.floor(x / starWidth) + 1;
  const withinStar = x - (star - 1) * starWidth;
  const half = withinStar < starWidth / 2 ? RATING_STEP : 1;

  return clampRating(star - 1 + half);
}

/** One arrow key: `delta` away from `value`, snapped back onto the 0.5 grid and clamped. */
export function stepRating(value: number, delta: number): number {
  return clampRating(Math.round((value + delta) / RATING_STEP) * RATING_STEP);
}

/** How much of star `star` (1-based) is painted: none, half, or all of it. */
export function starFill(value: number, star: number): 0 | 0.5 | 1 {
  if (value >= star) return 1;
  if (value >= star - RATING_STEP) return 0.5;
  return 0;
}

/** "3,5" — pt-BR, and never "3,0" for a whole star. */
export function formatRating(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

/**
 * The caption and the `aria-valuetext`, which say the same thing on purpose.
 *
 * `null` and `0` are two different answers and this is where they part company. `null` is "sem
 * nota" — nobody has said anything. `0` is an opinion: the member walked the bar all the way
 * down and left the book zero stars, and the club's list of who finished counts them in. Reading
 * a 0 as "sem nota" is what the SPA did until the two meanings were separated; if this ever goes
 * back to a single caption, the erase button and the finished list break together.
 */
export function ratingCaption(value: number | null): string {
  return value === null ? "sem nota" : `${formatRating(value)} de ${MAX_RATING}`;
}
