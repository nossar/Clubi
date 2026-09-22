import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "./api/client";
import type { MonthlyReading } from "./api/types";
import { useCurrentUser } from "./context/CurrentUser";

/**
 * The ceiling on a resenha, and a hand-kept twin of `books.models.REVIEW_MAX_LENGTH`.
 *
 * It is not generated: `MonthlyReadingIn.review` carries the limit as a pydantic constraint and
 * `openapi-typescript` emits the field as a plain `string | null`, so there is nothing in
 * `generated.ts` to read it from (ADR-12 covers the shape of the contract, not its bounds). The
 * number is duplicated on purpose rather than left to the server: a member who pastes four pages
 * of notes should be stopped by the textarea, not by a 422 after the fact.
 */
export const REVIEW_MAX_LENGTH = 4000;

/**
 * The bodies `PUT /api/monthly-picks/current/reading` accepts, as the screens actually send them.
 *
 * A union rather than one optional-everything object, because two of these combinations are a
 * 400 on arrival: `update_reading` refuses a request carrying both `rating` and `clear_rating`.
 * Written as a partial the compiler would have allowed it; written this way the shape that fails
 * server-side does not type-check.
 *
 * The two erasures look different, and that asymmetry is the API's rather than this file's.
 * A note erases with `{"clear_rating": true}` because `0` is a rating of its own; a resenha
 * erases with `{"review": ""}` because an empty resenha is unambiguously no resenha.
 */
export type ReadingWrite =
  | { pages_read: number }
  | { rating: number }
  | { clear_rating: true }
  | { review: string }
  | { finished: boolean };

/**
 * Every write to the member's reading of the current pick — progress, note, resenha, terminei.
 *
 * One hook for all of them because they are one row behind one endpoint, and because the set of
 * caches that go stale is the same whichever field moved. That set is the reason this is not
 * three `useMutation` calls spread across two components: it was drifting. Saving progress used
 * to leave `["user", me.username]` alone, and the profile prints "Chegou à página N" from the
 * very row that just changed — so a member who logged pages and opened their own profile read a
 * stale number until the 30s `staleTime` expired. Invalidating all three from one place is both
 * the fix and the thing that keeps the table in `frontend/CLAUDE.md` honest.
 *
 * Callers still create one instance *per control*. `isPending` and `error` belong to a mutation,
 * so a shared instance would put the failure of a rating under the pages field and disable both
 * buttons whenever either was in flight.
 */
export function useWriteReading(onWritten?: (reading: MonthlyReading) => void) {
  const queryClient = useQueryClient();
  const me = useCurrentUser();

  return useMutation({
    mutationFn: (body: ReadingWrite) =>
      api<MonthlyReading>("/monthly-picks/current/reading", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (reading) => {
      queryClient.invalidateQueries({ queryKey: ["reading", "current"] });
      // "Quem já terminou" is now filtered on a finished reading with a note *or* a resenha, so
      // all four writes can move a member on or off that list — including the resenha, which is
      // why this invalidation is no longer only the rating's business.
      queryClient.invalidateQueries({ queryKey: ["readers", "current"] });
      // The profile's reading history prints this same row: the pages, the note and the resenha.
      queryClient.invalidateQueries({ queryKey: ["user", me.username] });
      onWritten?.(reading);
    },
  });
}
