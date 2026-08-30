import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useUnreadPosts } from "../unreadPosts";

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
        <span className="notice__label">Tem gente escrevendo.</span>{" "}
        {unread === 1 ? "Uma postagem nova" : `${unread} postagens novas`} desde a sua última
        visita. <Link to="/posts">Ver as postagens</Link>
        {" · "}
        <button className="button button--quiet" type="button" onClick={dismiss}>
          Depois
        </button>
      </p>
    </div>
  );
}
