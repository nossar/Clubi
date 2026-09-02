import { describe, expect, it } from "vitest";

import type { ExternalBook } from "../api/types";
import { bookPayload, externalBookProblem } from "./externalBook";

/** A well-behaved Open Library hit: everything in range, nothing missing. */
const hit = (over: Partial<ExternalBook> = {}): ExternalBook => ({
  external_id: "OL45804W",
  title: "Fahrenheit 451",
  author: "Ray Bradbury",
  year: 1953,
  pages: 194,
  cover_url: "https://covers.openlibrary.org/b/id/8228691-L.jpg",
  ...over,
});

describe("externalBookProblem", () => {
  it("lets a normal hit through", () => {
    expect(externalBookProblem(hit())).toBeNull();
  });

  it("refuses a title longer than the column", () => {
    expect(externalBookProblem(hit({ title: "a".repeat(201) }))).toMatch(/título/);
    expect(externalBookProblem(hit({ title: "a".repeat(200) }))).toBeNull();
  });

  it("refuses an author list longer than the column", () => {
    // Open Library joins every credited name, so an anthology overruns 140 long before its title
    // overruns 200.
    expect(externalBookProblem(hit({ author: "a".repeat(141) }))).toMatch(/autoria/);
    expect(externalBookProblem(hit({ author: "a".repeat(140) }))).toBeNull();
  });

  it("refuses a hit with no title, but not one with no author", () => {
    expect(externalBookProblem(hit({ title: "   " }))).toMatch(/sem título/);
    // author_name is missing often enough that blocking on it would hide real books; "" is a
    // value BookIn accepts.
    expect(externalBookProblem(hit({ author: "" }))).toBeNull();
  });
});

describe("bookPayload", () => {
  it("passes a clean hit through unchanged, minus the synopsis nobody sent", () => {
    expect(bookPayload(hit())).toEqual({
      title: "Fahrenheit 451",
      author: "Ray Bradbury",
      year: 1953,
      pages: 194,
      synopsis: "",
      cover_url: "https://covers.openlibrary.org/b/id/8228691-L.jpg",
      external_id: "OL45804W",
    });
  });

  it("drops a year BookIn would reject instead of failing the whole registration", () => {
    // The Iliad and friends: first_publish_year is negative, and BookIn is ge=0.
    expect(bookPayload(hit({ year: -750 })).year).toBeNull();
    expect(bookPayload(hit({ year: 2300 })).year).toBeNull();
    expect(bookPayload(hit({ year: 0 })).year).toBe(0);
    expect(bookPayload(hit({ year: null })).year).toBeNull();
  });

  it("drops a page count below the ge=1 the schema asks for", () => {
    expect(bookPayload(hit({ pages: 0 })).pages).toBeNull();
    expect(bookPayload(hit({ pages: 1 })).pages).toBe(1);
    expect(bookPayload(hit({ pages: null })).pages).toBeNull();
  });

  it("drops a cover URL or an external id past the column, which BookIn does not bound", () => {
    expect(bookPayload(hit({ cover_url: `https://x/${"a".repeat(200)}` })).cover_url).toBe("");
    expect(bookPayload(hit({ external_id: "OL".repeat(40) })).external_id).toBe("");
  });
});
