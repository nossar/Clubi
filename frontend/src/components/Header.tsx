import { Link } from "react-router-dom";

import { csrfToken } from "../api/client";
import { useCurrentUser } from "../context/CurrentUser";

export function Header() {
  const user = useCurrentUser();
  const firstName = user.full_name.trim().split(" ")[0] || user.username;

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand-mark site-header__brand" to="/" aria-label="clubi" />

        <div className="site-header__account">
          {/* The greeting is also the way into your own profile — without it /u/:username would
              only be reachable through someone else's post. The Fase 7 search box lands here
              too. */}
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
