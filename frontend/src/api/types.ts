/* The thin hand-written layer over ./generated.ts, which comes from the Ninja OpenAPI schema
 * via `make types` and is never edited by hand (ADR-12). Run it again after touching any Schema
 * in the backend; `tsc --noEmit` is the guard that catches a renamed field. */

import type { components } from "./generated";

export type Book = components["schemas"]["BookOut"];
/**
 * The logged-in member — `GET /api/me`, and the two writes that answer with it. It is `MeOut`
 * rather than `UserOut` because only this endpoint carries `is_staff`: a public profile has no
 * business saying who may write postagens, and a projection would have made it project-wide
 * vocabulary (ADR-15, rule 3).
 */
export type Me = components["schemas"]["MeOut"];
/** The embedded projection: a member as a post author, a reader or a search hit. */
export type UserBrief = components["schemas"]["UserBrief"];
export type UserProfile = components["schemas"]["UserProfileOut"];
export type ProfilePatch = components["schemas"]["ProfileInPatch"];
export type ReadingHistory = components["schemas"]["ReadingHistoryOut"];
export type FavoritesPayload = components["schemas"]["FavoritesIn"];
export type MonthlyPick = components["schemas"]["MonthlyPickOut"];
export type MonthlyReading = components["schemas"]["MonthlyReadingOut"];
/** One member on the "quem já terminou" panel: a name and the note they left, nothing else. */
export type FinishedReader = components["schemas"]["FinishedReaderOut"];
export type Post = components["schemas"]["PostOut"];
export type PostPage = components["schemas"]["Page"];
export type PostPatch = components["schemas"]["PostInPatch"];
/** `GET /api/posts/unread` and `POST /api/posts/seen` both answer with this. */
export type UnreadPosts = components["schemas"]["UnreadPostsOut"];
/** A hit from the external catalogue — `GET /api/books/external`, the Open Library proxy. */
export type ExternalBook = components["schemas"]["ExternalBookOut"];
/**
 * The body of `POST /api/books`. `ExternalBookOut` was designed to carry exactly the fields this
 * accepts (guide 6.7), so a catalogue hit is posted back without translation — see
 * `components/externalBook.ts` for the two places that is not quite true.
 */
export type BookPayload = components["schemas"]["BookIn"];
