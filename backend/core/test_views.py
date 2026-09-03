"""The root view (ADR-18): `/` is the landing page for a visitor and the app for a member.

The deep-link tests at the bottom are the ADR-05 regression. The landing page was added *beside*
that flow, not into it, and the way to prove it is that an anonymous request for an authenticated
route still comes back as the SPA shell — which is what makes client.ts ask /api/me, take a 401
and redirect. If one of those ever starts returning the landing page, the redirect chain is gone.
"""

import pytest
from django.core.cache import cache
from django.urls import reverse

from core.views import CURRENT_PICK_KEY

pytestmark = pytest.mark.django_db

# django.utils.formats renders these from the pt-BR locale; hardcoding them here is what makes the
# assertion worth writing. With USE_I18N off, or LANGUAGE_CODE back to en-us, `date:"F"` renders
# "September" and the page silently stops speaking Portuguese.
MONTHS_PT = (
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
)


def written_day(date):
    """ "5 de setembro" — the same shape format.ts renders on the SPA side."""
    return f"{date.day} de {MONTHS_PT[date.month - 1]}"


@pytest.fixture(autouse=True)
def plain_staticfiles(settings):
    """Serve {% static %} without the hashed manifest for the whole module.

    DEBUG defaults to False (settings.py), so STORAGES picks WhiteNoise's manifest storage in any
    environment without a .env — CI included. index.html resolves its bundle through {% static %},
    and the manifest only exists after collectstatic, so rendering the shell would raise
    "Missing staticfiles manifest entry" there while passing on a developer's machine, where
    .env sets DEBUG=True. Pinning the backend makes these tests say the same thing in both.
    """
    settings.STORAGES = {
        **settings.STORAGES,
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }


def templates_used(response):
    return {template.name for template in response.templates if template.name}


class TestAnonymousRoot:
    def test_renders_the_landing_page(self, client):
        response = client.get("/")

        assert response.status_code == 200
        assert "landing.html" in templates_used(response)
        assert "index.html" not in templates_used(response)

    def test_ctas_point_at_the_rendered_auth_views(self, client):
        """ADR-05 owns login and signup; the landing links to them and defines nothing of its own."""
        content = client.get("/").content.decode()

        assert f'href="{reverse("login")}"' in content
        assert f'href="{reverse("signup")}"' in content

    def test_shows_the_current_pick(self, client, pick):
        content = client.get("/").content.decode()

        assert pick.book.title in content
        assert pick.book.author in content
        assert written_day(pick.starts_on) in content
        assert written_day(pick.ends_on) in content

    def test_falls_back_when_no_pick_is_active(self, client):
        content = client.get("/").content.decode()

        assert "A próxima leitura ainda está sendo escolhida." in content
        # Nothing to preview, so no og:image at all: a link card with a broken image reads worse
        # than one with none.
        assert 'property="og:image"' not in content

    def test_describes_the_pick_in_the_link_preview(self, client, pick):
        """The whole reason this page is rendered and not a SPA route — a crawler runs no JS."""
        content = client.get("/").content.decode()

        assert (
            f'<meta property="og:description" content="Neste mês estamos lendo {pick.book.title}'
            in content
        )

    def test_og_image_is_absolute(self, client, pick, image_upload):
        """A crawler will not resolve a relative og:image."""
        pick.book.cover = image_upload("capa.png")
        pick.book.save()

        content = client.get("/").content.decode()

        assert f'property="og:image" content="http://testserver{pick.book.cover.url}"' in content

    def test_leaks_no_template_comment(self, client, pick):
        """`{# … #}` is a single-line comment: broken across lines, Django emits it verbatim.

        Four of them were, and the page shipped developer commentary as body copy — on the one
        page the club publicises. Nothing else caught it, because every other assertion here is
        about content being present. This one is about text that must not be.
        """
        content = client.get("/").content.decode()

        assert "{#" not in content
        assert "{%" not in content

    def test_the_top_bar_carries_only_the_logotype(self, client):
        """The hero right below it holds the CTAs; two of each within one screen is one too many."""
        content = client.get("/").content.decode()
        top_bar = content.split("<main", 1)[0]

        assert "Criar conta" not in top_bar
        assert "Entrar" not in top_bar

    def test_varies_on_cookie(self, client):
        """One URL, two documents, chosen by the session — so a shared cache must not mix them."""
        assert "Cookie" in client.get("/").headers["Vary"]


class TestPickCache:
    """The landing query is cached, the response is not (ADR-18 keeps `/` varying on the cookie).

    On the Neon free plan every anonymous hit would otherwise open a connection to ask the same
    question. What is asserted here is the shape of the memoisation, not the TTL: that a repeat
    visit reads no database at all, that a *missing* pick is cached too — the sentinel's whole
    reason to exist — and that caching the query did not quietly start caching the page.
    """

    def test_second_visit_queries_nothing(self, client, pick, django_assert_num_queries):
        client.get("/")

        with django_assert_num_queries(0):
            content = client.get("/").content.decode()

        # current() select_related's the book, so the cached value carries it: the page renders
        # whole without a second query for the cover and the author.
        assert pick.book.title in content
        assert pick.book.author in content

    def test_absence_of_a_pick_is_cached_too(self, client, django_assert_num_queries):
        """cache.get() cannot tell a cached None from a miss; _MISS is what makes this pass."""
        client.get("/")

        with django_assert_num_queries(0):
            content = client.get("/").content.decode()

        assert "A próxima leitura ainda está sendo escolhida." in content

    def test_a_new_pick_is_seen_once_the_entry_is_gone(self, client, pick):
        """The staleness is bounded by the TTL — and by anything that drops the key."""
        client.get("/")
        pick.book.title = "Sagarana"
        pick.book.save()

        assert "Sagarana" not in client.get("/").content.decode()

        cache.delete(CURRENT_PICK_KEY)

        assert "Sagarana" in client.get("/").content.decode()

    def test_the_member_shell_is_not_served_from_the_cache(self, client, member, pick):
        """Caching the query must not have turned into caching the document."""
        client.get("/")
        client.force_login(member)

        assert "index.html" in templates_used(client.get("/"))


class TestMemberRoot:
    def test_gets_the_spa_shell(self, client, member):
        client.force_login(member)

        response = client.get("/")

        assert response.status_code == 200
        assert "index.html" in templates_used(response)
        assert "landing.html" not in templates_used(response)

    def test_never_sees_the_landing_copy(self, client, member, pick):
        """A member must not pass through the presentation on the way to the app."""
        client.force_login(member)

        content = client.get("/").content.decode()

        assert "Como funciona" not in content
        assert 'href="/accounts/signup/"' not in content

    def test_sets_the_csrf_cookie(self, client, member):
        """The shell's ensure_csrf_cookie has to survive being reached through the root view:
        without it client.ts has no token and every write of the session is rejected."""
        client.force_login(member)

        client.get("/")

        assert "csrftoken" in client.cookies

    def test_varies_on_cookie(self, client, member):
        client.force_login(member)

        assert "Cookie" in client.get("/").headers["Vary"]


class TestRoutingAround:
    """What the new `/` must not have disturbed."""

    def test_anonymous_deep_link_still_gets_the_shell(self, client):
        """The ADR-05 flow: the shell loads, /api/me answers 401, client.ts redirects."""
        response = client.get("/posts")

        assert response.status_code == 200
        assert "index.html" in templates_used(response)

    def test_deep_link_is_not_the_landing_page(self, client):
        assert "landing.html" not in templates_used(client.get("/u/ana"))

    def test_api_is_still_excluded_from_the_catch_all(self, client):
        """The catch-all's lookahead was left untouched on purpose; this is what it buys."""
        assert client.get("/api/nope").status_code == 404

    def test_admin_is_still_excluded(self, client):
        assert client.get("/admin/").status_code in (301, 302)
