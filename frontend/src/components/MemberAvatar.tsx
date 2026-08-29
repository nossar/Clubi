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
 */
export function MemberAvatar({ person }: { person: UserBrief }) {
  if (person.photo) {
    return <img className="avatar" src={person.photo} alt="" width={44} height={44} />;
  }

  return (
    <span className="avatar" aria-hidden="true">
      {initials(person.full_name || person.username)}
    </span>
  );
}
