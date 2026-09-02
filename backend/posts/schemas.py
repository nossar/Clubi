from datetime import datetime
from typing import Annotated

from ninja import Field, Schema

from api.schemas import BookOut, UserBrief


class PostIn(Schema):
    # Annotated, not `Field(max_length=...)` on the right-hand side: this schema is also used
    # through `PatchDict` in `update_post`, which rebuilds each field and drops a constraint
    # that lives in the default. See the ProfileIn docstring in users/schemas.py.
    title: Annotated[str, Field(max_length=140)]
    body: str
    book_id: int | None = None


class PostOut(Schema):
    id: int
    title: str
    body: str
    created_at: datetime
    author: UserBrief
    book: BookOut | None
    images: list[str]

    @staticmethod
    def resolve_images(obj):
        return [image.file.url for image in obj.images.all()]


class UnreadPostsOut(Schema):
    """How many postagens the member has not seen — see posts.api.unread_posts."""

    count: int


class Page(Schema):
    items: list[PostOut]
    total: int
    page: int
    has_next: bool
