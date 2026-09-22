"""The root view (ADR-18): `/` is the landing page for a visitor and the app for a member.

The deep-link tests at the bottom are the ADR-05 regression. The landing page was added *beside*
that flow, not into it, and the way to prove it is that an anonymous request for an authenticated
route still comes back as the SPA shell — which is what makes client.ts ask /api/me, take a 401
and redirect. If one of those ever starts returning the landing page, the redirect chain is gone.
"""

import re
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone

from books.models import Book, MonthlyPick
from core.views import CURRENT_PICK_KEY, PICK_HISTORY_KEY, PICK_HISTORY_LIMIT

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


def written_month(date):
    """ "agosto de 2026" — the eyebrow a past slide carries."""
    return f"{MONTHS_PT[date.month - 1]} de {date.year}"


def months_before(day, count):
    """The first day of the month `count` months before `day`."""
    year, month = day.year, day.month - count
    while month < 1:
        month += 12
        year -= 1
    return day.replace(year=year, month=month, day=1)


@pytest.fixture
def past_pick():
    """Factory for a pick that ended `months_ago` months ago, with a book of its own."""

    def make(months_ago=1, title=None, **fields):
        first = months_before(timezone.localdate(), months_ago)
        title = title or f"Leitura de {first:%m/%Y}"
        book = Book.objects.create(title=title, author=f"Autora de {title}")
        return MonthlyPick.objects.create(
            book=book,
            month=first,
            starts_on=first,
            ends_on=first + timedelta(days=27),
            **fields,
        )

    return make


def slides_of(content):
    """The carousel's slides in DOM order, as their data-carousel-label values."""
    return re.findall(r'data-carousel-label="([^"]*)"', content)


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


class TestCrawlerSurface:
    """What a robot is allowed to file away, which is the landing page and nothing else.

    The two documents `/` can answer (ADR-18) want opposite things from a crawler, so the tag
    that separates them is worth asserting rather than assuming: the landing exists to be
    indexed and shared, and the shell has nothing to show a robot at all — every route behind it
    is authenticated since ADR-19, and the markup is empty until React mounts.
    """

    def test_the_landing_page_stays_indexable(self, client):
        assert 'name="robots"' not in client.get("/").content.decode()

    def test_the_shell_is_noindex_for_a_member(self, client, member):
        client.force_login(member)

        assert '<meta name="robots" content="noindex">' in client.get("/").content.decode()

    def test_the_shell_is_noindex_on_a_deep_link(self, client):
        """The case that matters: /u/ana served to a robot that never logs in."""
        assert '<meta name="robots" content="noindex">' in client.get("/u/ana").content.decode()


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


class TestHistoryCache:
    """The carousel's query is memoised exactly like the current pick's, and for the same reason.

    A second reader of MonthlyPick on the one public page is a second way to keep the Neon
    compute awake (ADR-13), so the shape asserted for _current_pick() is asserted again here:
    the repeat visit reads nothing, the empty list is cached too, and the cached value is a
    materialised list carrying its books — not a QuerySet, which would pickle its query and run
    it again on every hit.
    """

    def test_second_visit_queries_nothing(self, client, pick, past_pick, django_assert_num_queries):
        older = past_pick(1, title="Torto Arado")
        client.get("/")

        with django_assert_num_queries(0):
            content = client.get("/").content.decode()

        assert pick.book.title in content
        assert older.book.title in content
        assert older.book.author in content

    def test_caches_a_list_with_the_books_loaded(self, client, pick, past_pick):
        past_pick(1)
        client.get("/")

        cached = cache.get(PICK_HISTORY_KEY)

        assert isinstance(cached, list)
        assert [item.pk for item in cached] == [pick.pk, MonthlyPick.objects.last().pk]
        assert all("book" in item._state.fields_cache for item in cached)

    def test_absence_of_history_is_cached_too(self, client, django_assert_num_queries):
        """cache.get() cannot tell a cached [] from a miss; _MISS is what makes this pass."""
        client.get("/")

        assert cache.get(PICK_HISTORY_KEY, "miss") == []
        with django_assert_num_queries(0):
            client.get("/")

    def test_a_past_pick_is_seen_once_the_entry_is_gone(self, client, pick, past_pick):
        """Bounded by the TTL, and by anything that drops the key — independently of the pick's."""
        client.get("/")
        older = past_pick(1, title="Quarto de Despejo")

        assert older.book.title not in client.get("/").content.decode()

        cache.delete(PICK_HISTORY_KEY)

        assert older.book.title in client.get("/").content.decode()

    def test_the_two_keys_are_independent(self, client, pick, past_pick):
        """Dropping the current pick's entry must not be what refreshes the history, or the other
        way round: each cache is a reader of its own, and the template tells the current slide
        apart by pk rather than by trusting the two to agree."""
        past_pick(1, title="Iracema")
        client.get("/")
        pick.book.title = "Sagarana"
        pick.book.save()

        cache.delete(CURRENT_PICK_KEY)
        content = client.get("/").content.decode()

        assert 'content="Neste mês estamos lendo Sagarana' in content  # from the fresh pick
        assert "Iracema" in content  # history still served from its own entry


class TestCarousel:
    """The months before this one, as slides — and what they must not change about the page.

    Smoke, not layout: what is asserted is the markup the script and the stylesheet hang off
    (`data-carousel-*`, `--i`), the order the DOM keeps (newest first, so a crawler and a screen
    reader meet the current book before any other), and that the head of the document — the
    reason this page is rendered at all (ADR-18) — still reads the current pick and nothing else.
    """

    def test_no_history_renders_no_carousel(self, client):
        content = client.get("/").content.decode()

        assert "A próxima leitura ainda está sendo escolhida." in content
        assert "data-carousel" not in content

    def test_the_current_pick_alone_is_one_slide(self, client, pick):
        """A carousel of one is a block; the script leaves the stack alone. The markup is the
        same either way, and the controls ship hidden for it to decide."""
        content = client.get("/").content.decode()

        assert slides_of(content) == [written_month(pick.month)]
        assert 'data-carousel-prev aria-label="Livro anterior" hidden' in content
        assert 'data-carousel-next aria-label="Próximo livro" hidden' in content
        assert pick.book.title in content
        assert "O livro deste mês" in content

    def test_one_previous_pick_is_a_second_slide(self, client, pick, past_pick):
        older = past_pick(1, title="A Hora da Estrela", blurb="Macabéa.")
        content = client.get("/").content.decode()

        assert slides_of(content) == [written_month(pick.month), written_month(older.month)]
        assert content.index(pick.book.title) < content.index(older.book.title)
        assert older.book.author in content
        assert written_day(older.starts_on) in content
        assert "Macabéa." in content
        # Only the current month is "O livro deste mês"; a past one is named by its month.
        assert content.count("O livro deste mês") == 1
        assert '<p class="pick__eyebrow pick__eyebrow--past">\n' in content
        assert written_month(older.month) in content

    def test_several_previous_picks_keep_newest_first(self, client, pick, past_pick):
        """`--i` counts from the newest: the stylesheet turns it into the reversed `order` that
        lays the months out left to right in time, so the value has to follow the DOM order."""
        older = [past_pick(n, title=f"Livro {n}") for n in (3, 1, 2)]
        content = client.get("/").content.decode()

        expected = [pick] + sorted(older, key=lambda item: item.month, reverse=True)
        assert slides_of(content) == [written_month(item.month) for item in expected]
        assert re.findall(r"--i: (\d+)", content) == ["1", "2", "3", "4"]
        assert "{#" not in content
        assert "{%" not in content

    def test_between_picks_the_front_slide_is_this_month(self, client, past_pick):
        """No current pick, but a history: the carousel still starts at today, with the same
        sentence the page shows when there is nothing at all, and moves back from there."""
        older = past_pick(1, title="Capitães da Areia")
        content = client.get("/").content.decode()

        assert slides_of(content) == ["Este mês", written_month(older.month)]
        assert "A próxima leitura ainda está sendo escolhida." in content
        assert 'style="--i: 0"' in content
        assert "O livro deste mês" in content
        assert older.book.title in content

    def test_a_future_pick_is_not_a_slide(self, client, pick):
        """The landing says what the club is reading, never what it will read."""
        today = timezone.localdate()
        first_of_next = months_before(today, -1)
        MonthlyPick.objects.create(
            book=Book.objects.create(title="Macunaíma", author="Mário de Andrade"),
            month=first_of_next,
            starts_on=first_of_next,
            ends_on=first_of_next + timedelta(days=27),
        )

        content = client.get("/").content.decode()

        assert "Macunaíma" not in content
        assert slides_of(content) == [written_month(pick.month)]

    def test_history_is_capped(self, client, pick, past_pick):
        """Twelve months of picks and no more: the carousel is a presentation, not the archive."""
        for n in range(1, PICK_HISTORY_LIMIT + 1):
            past_pick(n, title=f"Livro {n}")

        content = client.get("/").content.decode()

        assert len(slides_of(content)) == PICK_HISTORY_LIMIT
        assert "Livro 1" in content
        assert f"Livro {PICK_HISTORY_LIMIT - 1}" in content
        assert f"Livro {PICK_HISTORY_LIMIT}" not in content

    def test_og_tags_read_the_current_pick_only(self, client, pick, past_pick, image_upload):
        """The link preview is the reason this page exists (ADR-18), and it describes this month.
        A cover on a past pick must not become the og:image, and a past title must not leak into
        the description."""
        older = past_pick(1, title="O Cortiço")
        older.book.cover = image_upload("cortico.png")
        older.book.save()

        content = client.get("/").content.decode()
        head = content.split("<body", 1)[0]

        assert 'property="og:image"' not in head
        assert f'content="Neste mês estamos lendo {pick.book.title}' in head
        assert "O Cortiço" not in head
        assert older.book.cover.url in content  # the slide still shows it

    def test_og_tags_stay_generic_between_picks(self, client, past_pick, image_upload):
        older = past_pick(1, title="Dom Casmurro")
        older.book.cover = image_upload("casmurro.png")
        older.book.save()

        head = client.get("/").content.decode().split("<body", 1)[0]

        assert 'property="og:image"' not in head
        assert 'property="og:description" content="O clube do livro na ESPM."' in head

    def test_controls_ship_hidden_with_their_labels(self, client, pick, past_pick):
        """Arrows, dots and the live region are progressive enhancement: the arrows ship `hidden`
        with the phrase in aria-label and the glyph out of the accessibility tree, the dots box
        ships empty (the script builds one dot per slide it finds), and none of it is needed for
        the months to be readable — the stack is the markup as served."""
        past_pick(1)
        content = client.get("/").content.decode()

        assert 'data-carousel-prev aria-label="Livro anterior" hidden' in content
        assert 'data-carousel-next aria-label="Próximo livro" hidden' in content
        assert '<span aria-hidden="true">‹</span>' in content
        assert '<span aria-hidden="true">›</span>' in content
        assert re.search(
            r'data-carousel-dots role="group" aria-label="Ir para um mês"\s+hidden></div>', content
        )
        assert 'carousel__dot"' not in content  # no dots in the served markup
        assert 'data-carousel-status aria-live="polite"></p>' in content
        # Words, never chevrons, everywhere else on the page (DESIGN.md 6.3): the two glyphs are
        # the exception E-19 registers, and they must not spread.
        assert content.count("‹") == 1
        assert content.count("›") == 1

    def test_loads_its_own_static_files(self, client, pick):
        """Served by Django through {% static %}, never through the Vite build."""
        content = client.get("/").content.decode()

        assert 'href="/static/css/landing-carousel.css"' in content
        assert '<script defer src="/static/js/landing-carousel.js"></script>' in content
        assert "5173" not in content

    def test_varies_on_cookie(self, client, pick, past_pick):
        """More slides, same two documents: the header ADR-18 leans on is untouched."""
        past_pick(1)

        assert "Cookie" in client.get("/").headers["Vary"]

    def test_survives_the_manifest_storage(self, client, pick, past_pick, settings, tmp_path):
        """Production serves the landing's files through the hashed manifest (WhiteNoise's
        CompressedManifestStaticFilesStorage). A new file that {% static %} names has to be in
        that manifest, or the page raises "Missing staticfiles manifest entry" on the first hit —
        on the one page the club publicises. Collect for real and render against it."""
        past_pick(1)
        settings.STATIC_ROOT = tmp_path / "staticfiles"
        settings.STORAGES = {
            **settings.STORAGES,
            "staticfiles": {
                "BACKEND": "django.contrib.staticfiles.storage.ManifestStaticFilesStorage"
            },
        }
        call_command("collectstatic", interactive=False, verbosity=0, ignore_patterns=["admin"])

        content = client.get("/").content.decode()

        assert re.search(r'href="/static/css/landing-carousel\.[0-9a-f]{12}\.css"', content)
        assert re.search(r'src="/static/js/landing-carousel\.[0-9a-f]{12}\.js"', content)


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

    def test_leaks_no_template_comment(self, client, member):
        """The landing's lesson, learned a second time on the other document `/` serves.

        A multi-line `{# … #}` above the robots tag shipped to production as a paragraph at the
        top of every member's page. The landing had the assertion; the shell did not.
        """
        client.force_login(member)

        content = client.get("/").content.decode()

        assert "{#" not in content
        assert "{%" not in content

    def test_sets_the_csrf_cookie(self, client, member):
        """The shell's ensure_csrf_cookie has to survive being reached through the root view:
        without it client.ts has no token and every write of the session is rejected."""
        client.force_login(member)

        client.get("/")

        assert "csrftoken" in client.cookies

    def test_varies_on_cookie(self, client, member):
        client.force_login(member)

        assert "Cookie" in client.get("/").headers["Vary"]


class TestHealthCheck:
    """The check Render polls every few seconds, and the one query count that is a cost ceiling.

    On the Neon free plan the compute sleeps after five minutes without a query, and the month
    buys 100 CU-hours. A single query here would reset that timer forever — the database would
    never sleep and the allowance would be gone by mid-month, which Neon answers by suspending
    the compute until the next cycle. So `test_costs_no_query` is the test of this module: the
    status code is incidental, the zero is the point.
    """

    def test_is_ok(self, client):
        response = client.get("/healthz")

        assert response.status_code == 200
        assert response.content == b"ok"

    def test_costs_no_query(self, client, django_assert_num_queries):
        """Not one — not the session, not the user, not a connection opened and left idle.

        Every middleware in the stack is lazy enough to spend nothing on an anonymous GET that
        reads neither request.session nor request.user. This asserts that rather than trusting
        it, because the way it breaks is by someone adding a line to the view.
        """
        with django_assert_num_queries(0):
            client.get("/healthz")

    def test_is_not_cached(self, client):
        """A cached 200 is a health check that keeps saying yes after the worker has died."""
        assert "no-cache" in client.get("/healthz").headers["Cache-Control"]

    def test_is_exempt_from_the_https_redirect(self, client, settings):
        """SecurityMiddleware runs before the view; without the exemption it answers instead.

        Render's internal probe arrives over plain HTTP, so the redirect would fire on every
        check. It counts a 3xx as healthy — which is why this fails silently in production and
        has to be caught here.
        """
        settings.SECURE_SSL_REDIRECT = True
        settings.SECURE_REDIRECT_EXEMPT = [r"^healthz$"]

        assert client.get("/healthz").status_code == 200

    def test_is_not_swallowed_by_the_catch_all(self, client):
        """The lookahead does not exclude healthz, so only the URL order keeps the shell off it."""
        assert "index.html" not in templates_used(client.get("/healthz"))


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
