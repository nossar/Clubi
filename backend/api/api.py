"""The API's mount point (ADR-15).

No schemas, no routes, no business logic: each app publishes its own router and
this file decides the prefix, the auth and the tag. It is the one place that
shows the whole surface the SPA can call.
"""

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


# No csrf= argument: since django-ninja 1.x the CSRF check lives in the auth class,
# and django_auth (SessionAuth) enforces it on every unsafe method by default.
api = ClubiAPI(
    title="Clubi API",
    version="1.0.0",
    description="API do Clubi — clube do livro da ESPM.",
    docs_url="/docs",
)

api.add_router("/me", me_router, auth=django_auth, tags=["me"])
api.add_router("/users", users_router, tags=["users"])
api.add_router("/books", books_router, tags=["books"])
api.add_router("/monthly-picks", picks_router, tags=["monthly-picks"])
api.add_router("/posts", posts_router, tags=["posts"])
