import { Link } from "react-router-dom";

import type { UserBrief } from "../api/types";
import { initials } from "../format";

/**
 * A member's photo, or their initials when there is none — `photo` is a URL string or `null`,
 * never an object, so the fallback is not optional.
 *
 * The image is `alt=""` on purpose: every caller prints the member's name right next to it, so
 * the avatar is decoration and a second reading of the name would be noise.
 *
 * `PostCard`, `PostDetail` and `ReadersList` each carried a copy of this ternary before Fase 7
 * needed it twice more, in the header's suggestions and in `Search`. Five copies is how the alt
 * text, the size and the initials fallback drift apart — same reasoning that moved `initials()`
 * into `format.ts` in Fase 5.
 *
 * `linkTo` makes the photo itself a way into that member's profile, which is what a reader tries
 * first on a byline. **It is a redundant link on purpose, and it is hidden from assistive tech**
 * — `aria-hidden` with `tabIndex={-1}`, which is safe only together: the name beside it already
 * links to the same place, so a second tab stop and a second announcement of the same destination
 * would be noise, exactly like the `alt=""` above. Callers that wrap the whole member in one link
 * already (`Search`, `MemberSearch`) must not pass it.
 */
export function MemberAvatar({ person, linkTo }: { person: UserBrief; linkTo?: string }) {
  const avatar = person.photo ? (
    <img className="avatar" src={person.photo} alt="" width={44} height={44} />
  ) : (
    <span className="avatar" aria-hidden="true">
      {initials(person.full_name || person.username)}
    </span>
  );

  if (!linkTo) return avatar;

  return (
    <Link className="avatar-link" to={linkTo} aria-hidden="true" tabIndex={-1}>
      {avatar}
    </Link>
  );
}
