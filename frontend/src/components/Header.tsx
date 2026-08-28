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
          <span className="site-header__greeting">Olá, {firstName}</span>
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
