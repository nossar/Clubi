"""The whole shared surface of the API (ADR-15).

Only *projections* live here: schemas that describe one entity, import no other
schema, and exist to be embedded in other apps' responses. A response shape —
what a single endpoint returns — belongs to the app that owns the route.
"""

from ninja import ModelSchema, Schema

from books.models import Book


class BookOut(ModelSchema):
    cover_image: str

    class Meta:
        model = Book
        fields = ["id", "title", "author", "year", "pages", "synopsis"]


class UserBrief(Schema):
    username: str
    full_name: str
    photo: str | None
