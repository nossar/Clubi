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
const TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "agosto de 2026" */
export function formatMonth(iso: string): string {
  return MONTH.format(parseApiDate(iso));
}

/** "20 de setembro" */
export function formatDay(iso: string): string {
  return DAY.format(parseApiDate(iso));
}

/**
 * "20 de setembro às 14:30" — for `Post.created_at`, which unlike the dates above is a full
 * timestamp with an offset, so it parses correctly with a plain `new Date()` and needs no
 * `parseApiDate` anchoring.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${DAY.format(date)} às ${TIME.format(date)}`;
}

/** "Ana Beatriz" -> "AB"; the fallback for an avatar with no photo on file. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
