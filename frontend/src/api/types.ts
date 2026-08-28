/* The thin hand-written layer over ./generated.ts, which comes from the Ninja OpenAPI schema
 * via `make types` and is never edited by hand (ADR-12). Run it again after touching any Schema
 * in the backend; `tsc --noEmit` is the guard that catches a renamed field. */

import type { components } from "./generated";

export type Book = components["schemas"]["BookOut"];
export type User = components["schemas"]["UserOut"];
export type MonthlyPick = components["schemas"]["MonthlyPickOut"];
export type MonthlyReading = components["schemas"]["MonthlyReadingOut"];
export type Reader = components["schemas"]["ReaderOut"];
