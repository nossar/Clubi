"""The views that are neither the SPA nor the API.

`core` has no models: what it holds is the furniture the domain apps share — `core/images.py`, the
CSS under `core/static/`, and the two views below, which decide what the site's root actually is.
The landing page belongs to no domain (it is about the club, not about books, users or postagens),
which is why it is not in one of their `views.py` (ADR-15 files code by the models behind it, and
this has none).

The import of `books.models` is one-directional and safe: `books.api` imports `core.images`, but
nothing in `books` imports this module, so there is no cycle.
"""

from django.core.cache import cache
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.generic import TemplateView

from books.models import MonthlyPick

# The SPA shell, defined once and served from two places: the catch-all in clubi/urls.py, and
# root() below when a member is already signed in. It used to be written inline at the catch-all;
# a second copy for `/` is how the two would slowly stop being the same response — and the half
# most likely to go missing is ensure_csrf_cookie, which fails silently until the first write of
# the session is rejected (clubi/urls.py has the long version of that warning).
shell = ensure_csrf_cookie(TemplateView.as_view(template_name="index.html"))

CURRENT_PICK_KEY = "current_pick"
CURRENT_PICK_TTL = 60 * 15

# A miss is not the same thing as a cached None, and cache.get() with no default cannot tell them
# apart — it returns None for both. MonthlyPick.current() legitimately answers None (between two
# picks, or before the first one), and that is exactly the answer worth caching: the landing page
# of a club with no active reading would otherwise be the one that queries on every hit. Hence the
# sentinel, which is only ever compared by identity and never leaves this module.
_MISS = object()


def _current_pick() -> MonthlyPick | None:
    """MonthlyPick.current(), memoised for 15 minutes.

    The landing page is public and uncacheable as a whole — `/` answers with two documents chosen
    by the session, so `Vary: Cookie` is load-bearing (ADR-18) and a page cache would have to be
    keyed by cookie to be correct. What repeats across every anonymous hit is not the document but
    the query behind it, and on the Neon free plan (ADR-13) each of those is a connection to a
    database that would rather be asleep. So the query is what gets cached.

    current() selects the book along with the pick, so the cached value carries it too and a hit
    renders the whole page without touching the database. The cost is staleness: a pick edited in
    the Admin (ADR-14) takes up to CURRENT_PICK_TTL to show up here. A monthly pick changes twelve
    times a year, so fifteen minutes is a cheap trade — but it is a trade, and the founder seeing
    an old blurb for a few minutes after saving is this, not a bug.
    """
    pick = cache.get(CURRENT_PICK_KEY, _MISS)
    if pick is _MISS:
        pick = MonthlyPick.current()
        cache.set(CURRENT_PICK_KEY, pick, CURRENT_PICK_TTL)
    return pick


def root(request):
    """`/` — the landing page for a visitor, the app itself for a member (ADR-18).

    One URL answering with two documents, chosen by the session. Deliberately not a redirect: `/`
    is the SPA's Home in the guide's route table and the target of `LOGIN_REDIRECT_URL`, so a
    member who has just signed in has to land on the app here, not be bounced somewhere else.

    Nothing about the ADR-05 flow changes. A deep link into an authenticated route never reaches
    this view — it does not match `path("")` — so it still falls through to the catch-all, gets
    the shell, and is redirected by client.ts when `/api/me` answers 401.

    Reading `request.user` touches the session, so SessionMiddleware stamps `Vary: Cookie` on the
    response. That header is what stops a shared cache from serving the app shell to an anonymous
    visitor, or this page to a member; core/test_views.py asserts it rather than trusting it.
    """
    if request.user.is_authenticated:
        return shell(request)

    pick = _current_pick()
    cover = pick.book.cover_image if pick else ""
    return render(
        request,
        "landing.html",
        {
            "pick": pick,
            # A crawler will not resolve a relative og:image, and this one has three possible
            # shapes: an absolute R2 URL (ADR-11), an absolute cover_url from the external
            # catalogue, or the relative /media/ path of a local upload in development.
            # build_absolute_uri absolutises the third and leaves the first two untouched.
            "cover_url": request.build_absolute_uri(cover) if cover else "",
        },
    )
