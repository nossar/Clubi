import { describe, expect, it } from "vitest";

import {
  clampRating,
  formatRating,
  ratingCaption,
  ratingFromPosition,
  starFill,
  stepRating,
} from "./ratingScale";

// A 5-star bar 220px wide: 44px per star (the touch target of DESIGN.md 10.4), 22px per half.
const WIDTH = 220;
const at = (x: number) => ratingFromPosition(x, WIDTH);

describe("ratingFromPosition", () => {
  it("gives the left half of a star to that star, not to the one before it", () => {
    expect(at(0)).toBe(0.5); // first pixel of star 1
    expect(at(21)).toBe(0.5); // still its left half
    expect(at(22)).toBe(1); // its right half
    expect(at(43)).toBe(1);
  });

  it("walks the whole bar in half steps", () => {
    const values = Array.from({ length: 10 }, (_, half) => at(half * 22 + 11));

    expect(values).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });

  it("puts each boundary on the star the cursor is over", () => {
    expect(at(88)).toBe(2.5); // first pixel of star 3
    expect(at(87)).toBe(2); // last pixel of star 2
    expect(at(110)).toBe(3); // middle of star 3
  });

  it("reads a drag off the left end as zero stars", () => {
    expect(at(-1)).toBe(0);
    expect(at(-500)).toBe(0);
  });

  it("clamps a drag off the right end to 5", () => {
    expect(at(WIDTH)).toBe(5);
    expect(at(WIDTH + 400)).toBe(5);
  });

  it("survives a bar that has not been measured yet", () => {
    expect(ratingFromPosition(10, 0)).toBe(0);
    expect(ratingFromPosition(10, Number.NaN)).toBe(0);
  });

  it("does not care how wide the bar is", () => {
    expect(ratingFromPosition(5, 100)).toBe(0.5);
    expect(ratingFromPosition(15, 100)).toBe(1);
    expect(ratingFromPosition(99, 100)).toBe(5);
  });
});

describe("stepRating", () => {
  it("moves half a star at a time", () => {
    expect(stepRating(3, 0.5)).toBe(3.5);
    expect(stepRating(3.5, -0.5)).toBe(3);
    expect(stepRating(2, 1)).toBe(3);
  });

  it("stops at the ends instead of wrapping", () => {
    expect(stepRating(0, -0.5)).toBe(0);
    expect(stepRating(5, 0.5)).toBe(5);
  });

  // The server only ever sends multiples of 0.5, so this is the guard behind the guard.
  it("snaps a value that somehow left the grid back onto it", () => {
    expect(stepRating(3.3, 0)).toBe(3.5);
    expect(stepRating(3.3, 0.5)).toBe(4);
    expect(stepRating(3.3, -0.5)).toBe(3);
  });
});

describe("starFill", () => {
  it("splits a rating into empty, half and full stars", () => {
    expect([1, 2, 3, 4, 5].map((star) => starFill(3.5, star))).toEqual([1, 1, 1, 0.5, 0]);
    expect([1, 2, 3, 4, 5].map((star) => starFill(0, star))).toEqual([0, 0, 0, 0, 0]);
    expect([1, 2, 3, 4, 5].map((star) => starFill(5, star))).toEqual([1, 1, 1, 1, 1]);
    expect([1, 2, 3, 4, 5].map((star) => starFill(0.5, star))).toEqual([0.5, 0, 0, 0, 0]);
  });

  it("agrees with the pointer: the star under the cursor is the one being half filled", () => {
    expect(starFill(at(11), 1)).toBe(0.5);
    expect(starFill(at(99), 3)).toBe(0.5);
    expect(starFill(at(121), 3)).toBe(1);
  });
});

describe("clampRating", () => {
  it("keeps a rating inside the API's range", () => {
    expect(clampRating(-1)).toBe(0);
    expect(clampRating(11)).toBe(5);
    expect(clampRating(2.5)).toBe(2.5);
  });
});

describe("formatRating and ratingCaption", () => {
  it("writes the half in pt-BR and leaves a whole star whole", () => {
    expect(formatRating(3.5)).toBe("3,5");
    expect(formatRating(3)).toBe("3");
  });

  it("keeps zero stars apart from no rating at all", () => {
    // The two used to print the same words, back when 0 was the only way to erase a note.
    expect(ratingCaption(null)).toBe("sem nota");
    expect(ratingCaption(0)).toBe("0 de 5");
    expect(ratingCaption(4.5)).toBe("4,5 de 5");
  });
});
