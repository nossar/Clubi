import { Link } from "react-router-dom";

import { csrfToken } from "../api/client";
import { useCurrentUser } from "../context/CurrentUser";
import { useUnreadPosts } from "../unreadPosts";
import { BrandElement } from "./BrandElement";
import { MemberSearch } from "./MemberSearch";

/** More than this and the badge stops being a glance — the feed itself has the real number. */
const BADGE_CEILING = 9;

export function Header() {
  const user = useCurrentUser();
  const unread = useUnreadPosts();
  const firstName = user.full_name.trim().split(" ")[0] || user.username;

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand-mark site-header__brand" to="/" aria-label="clubi" />

        {/* Mounted once here so search is reachable from every screen, and it is a field with a
            placeholder rather than a magnifier — DESIGN.md 6.3 names this exact case (E-07). At
            390px it drops to its own row under the logo. */}
        <MemberSearch />

        <div className="site-header__account">
          {/* The way into the postagens, and the one place a brand element stands next to a
              control. DESIGN.md 6.3 splits the two — element where an icon carries meaning, word
              where it is a control — and the balão is already the element it assigns to a post,
              so the resolution is to do both rather than pick: the balão with the word beside it.
              A balão alone would have been the mute icon-as-button E-07 rules out. */}
          <Link className="site-header__posts" to="/posts">
            <span className="site-header__balao">
              <BrandElement name="balao" />
              {/* Colour is never the only signal (DESIGN.md 10.3), so the dot carries the number
                  rather than just appearing, and the sentence below it is what a screen reader
                  hears — the dot itself is decoration to them. */}
              {unread > 0 ? (
                <span className="site-header__badge" aria-hidden="true">
                  {unread > BADGE_CEILING ? `${BADGE_CEILING}+` : unread}
                </span>
              ) : null}
            </span>
            Postagens
            {unread > 0 ? (
              <span className="visually-hidden">
                {unread === 1 ? "1 postagem não lida" : `${unread} postagens não lidas`}
              </span>
            ) : null}
          </Link>

          {/* The greeting is also the way into your own profile — without it /u/:username
              would only be reachable through someone else's post or the search. */}
          <Link className="site-header__greeting" to={`/u/${user.username}`}>
            <span className="site-header__hello">Olá, </span>
            {firstName}
          </Link>
          {/* Logout is a rendered POST, not an API call: it belongs to django.contrib.auth
              (ADR-05), and LogoutView refuses GET. The token comes from the same cookie the
              API client uses. */}
          <form method="post" action="/accounts/logout/">
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken()} />
            <button className="button button--quiet" type="submit">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
