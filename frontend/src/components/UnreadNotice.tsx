import { useEffect, useState } from "react";

import { useUnreadPosts } from "../unreadPosts";
import { BrandElement } from "./BrandElement";

/* Survives an F5 but not a new tab, which is exactly "na mesma sessão". The value stored is the
 * count the member waved away, so a postagem that arrives afterwards brings the invitation back
 * while a reload does not. Reaching zero — which is what opening the feed does — forgets it, so
 * the next batch is announced even if it happens to be the same size as the one dismissed. */
const DISMISSED_KEY = "clubi:postagens-dispensadas";

function readDismissed(): number {
  try {
    return Number(window.sessionStorage.getItem(DISMISSED_KEY)) || 0;
  } catch {
    // Private windows and blocked storage throw on read. Then the notice simply behaves as if
    // nothing was ever dismissed, which is the safe direction: it invites, it does not block.
    return 0;
  }
}

function writeDismissed(count: number) {
  try {
    if (count > 0) window.sessionStorage.setItem(DISMISSED_KEY, String(count));
    else window.sessionStorage.removeItem(DISMISSED_KEY);
  } catch {
    // Nothing to do: the member dismissed it for this render either way.
  }
}

/**
 * The greeting for a member who arrives with postagens waiting — an invitation, not an alert
 * (DESIGN.md 9). It is the plain `.notice`, without the `--error`/`--ok` modifiers: those two
 * colours mean something went wrong or right, and nothing here did either.
 *
 * It reads the same `["posts", "unread"]` query the header badge does, so arriving costs one
 * request and not two, and it disappears on its own the moment the feed marks them read.
 *
 * It carries no link, on purpose: the way to the postagens is the balão in the header directly
 * above it (DESIGN.md 6.3, E-14), which is on every screen and already wears this same count. A
 * second door to the same room, one line under the first, is a duplicate rather than a shortcut.
 */
export function UnreadNotice() {
  const unread = useUnreadPosts();
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    if (unread === 0 && dismissed !== 0) {
      setDismissed(0);
      writeDismissed(0);
    }
  }, [unread, dismissed]);

  if (unread === 0 || unread <= dismissed) return null;

  function dismiss() {
    setDismissed(unread);
    writeDismissed(unread);
  }

  return (
    <div className="container unread-notice">
      <p className="notice">
        Você possui{" "}
        <span className="notice__label">
          {unread === 1 ? "1 postagem nova" : `${unread} postagens novas`}
        </span>{" "}
        desde sua última visita.
      </p>
      {/* The × of DESIGN.md 6.3 rule 3 (E-16), the same glyph the shelf uses to take a book off
          it: closing an aviso is the one thing that glyph was already reserved for, and the word
          it replaced lives on in aria-label and title. It is deliberately smaller than the
          shelf's — see the CSS, where the 44px touch target overhangs a one-line row. */}
      <button
        className="unread-notice__dismiss"
        type="button"
        onClick={dismiss}
        title="Dispensar o aviso"
        aria-label="Dispensar o aviso"
      >
        <BrandElement name="x" />
      </button>
    </div>
  );
}
