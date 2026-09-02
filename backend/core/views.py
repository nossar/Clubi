"""The views that are neither the SPA nor the API.

`core` has no models: what it holds is the furniture the domain apps share — `core/images.py`, the
CSS under `core/static/`, and the two views below, which decide what the site's root actually is.
The landing page belongs to no domain (it is about the club, not about books, users or postagens),
which is why it is not in one of their `views.py` (ADR-15 files code by the models behind it, and
this has none).

The import of `books.models` is one-directional and safe: `books.api` imports `core.images`, but
nothing in `books` imports this module, so there is no cycle.
"""

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

    pick = MonthlyPick.current()
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
