"""The API's mount point (ADR-15).

No schemas, no routes, no business logic: each app publishes its own router and
this file decides the prefix, the auth and the tag. It is the one place that
shows the whole surface the SPA can call.
"""

from django.conf import settings
from django.http import Http404
from ninja import NinjaAPI
from ninja.security import django_auth

from books.api import books_router, picks_router
from posts.api import posts_router
from users.api import me_router, users_router


class ClubiAPI(NinjaAPI):
    def get_openapi_operation_id(self, operation) -> str:
        """Name operations after the view alone, not "<module>_<view>".

        Ninja's default embeds the Python module path in the operationId, which
        pins the public contract to the file layout: moving a route between apps
        renames its operation and churns the generated frontend types. The view
        name is stable across such moves, which is what lets ADR-15 claim that
        app layout is a code decision and not an API one. Uniqueness across the
        whole surface is asserted in api/test_api.py.
        """
        return operation.view_func.__name__


# auth=django_auth is declared once, here, and it is the whole authentication policy: the API is
# for members, and a route that says nothing about auth inherits "authenticated" rather than
# "public" (ADR-19). It used to be the reverse — no global auth, so a new route was born readable
# by anyone and, because ninja marks every API view csrf_exempt at the middleware level, writable
# without a CSRF token too. Nothing failed when someone forgot the decorator, which is why the
# default is now the safe one and the exceptions are named in PUBLIC_OPERATIONS below.
#
# No csrf= argument: since django-ninja 1.x the CSRF check lives in the auth class, and
# django_auth (SessionAuth) enforces it on every unsafe method by default. Safe methods are
# exempted by CsrfViewMiddleware.process_view, so authenticating GETs globally costs them nothing.
def development_or_staff_only(view):
    """Gate for /api/docs and /api/openapi.json — ninja applies this to both.

    Swagger and the raw schema are development tools; in production they hand a map of the whole
    surface to whoever asks. Nothing behind them is secret — every operation is authenticated
    since ADR-19 — but the shape of an API is a courtesy only the people building it need, and the
    founder operating the club through the Admin (ADR-14) is the one exception worth keeping.

    Decided per request rather than by passing `docs_url=None`. Reading `settings.DEBUG` at import
    time would make the site's behaviour depend on when this module happened to be imported, which
    is a thing that varies between the dev server, gunicorn and the test run — and it did: pytest
    imports this during collection, before the test environment sets DEBUG to False.

    404 rather than 403, because the answer to "is there an API doc here" should not be yes.
    """

    def guarded(request, *args, **kwargs):
        if not settings.DEBUG and not request.user.is_staff:
            raise Http404
        return view(request, *args, **kwargs)

    return guarded


api = ClubiAPI(
    title="Clubi API",
    version="1.0.0",
    description="API do Clubi — clube do livro da ESPM.",
    auth=django_auth,
    docs_url="/docs",
    docs_decorator=development_or_staff_only,
)

# The exceptions to the line above, by operationId, and it is deliberately empty.
#
# Nothing is public. The Clubi's public surface is the landing page of ADR-18 and nothing else:
# it is rendered by Django and reads the current pick straight from the ORM
# (core.views._current_pick → MonthlyPick.current), so closing /api/monthly-picks costs it
# nothing. /api/users, /api/users/{username}, /api/books and /api/posts are closed for the same
# reason they were the problem — a profile carries birth_date, the shelf and every review the
# member ever wrote, and ADR-18 exists to get the address in front of strangers.
#
# This is the single place to decide otherwise, and api/test_api.py reads it as the source of
# truth: every operation NOT named here must answer 401 to an anonymous caller, and every
# operation named here must not. Adding an entry takes a comment saying why that route is
# something a stranger may read — "the SPA needs it" is not a reason, because the SPA is
# authenticated (ADR-19).
PUBLIC_OPERATIONS: frozenset[str] = frozenset()

api.add_router("/me", me_router, tags=["me"])
api.add_router("/users", users_router, tags=["users"])
api.add_router("/books", books_router, tags=["books"])
api.add_router("/monthly-picks", picks_router, tags=["monthly-picks"])
api.add_router("/posts", posts_router, tags=["posts"])
