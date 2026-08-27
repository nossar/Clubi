"""The API's mount point (ADR-15).

No schemas, no routes, no business logic: each app publishes its own router and
this file decides the prefix, the auth and the tag. It is the one place that
shows the whole surface the SPA can call.
"""

from ninja import NinjaAPI

# No csrf= argument: since django-ninja 1.x the CSRF check lives in the auth class,
# and django_auth (SessionAuth) enforces it on every unsafe method by default.
api = NinjaAPI(
    title="Clubi API",
    version="1.0.0",
    description="API do Clubi — clube do livro da ESPM.",
    docs_url="/docs",
)
