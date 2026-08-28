/* Display formatting. Every string the SPA renders is user-facing, so the locale is pt-BR. */

/**
 * The API sends plain dates as YYYY-MM-DD. `new Date("2026-08-01")` parses that as UTC midnight,
 * which in America/Sao_Paulo lands on 31 July — and the month label would silently read "julho".
 * Anchoring to local midnight is what keeps "agosto de 2026" saying agosto.
 */
export function parseApiDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

const MONTH = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const DAY = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

/** "agosto de 2026" */
export function formatMonth(iso: string): string {
  return MONTH.format(parseApiDate(iso));
}

/** "20 de setembro" */
export function formatDay(iso: string): string {
  return DAY.format(parseApiDate(iso));
}
