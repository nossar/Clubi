from datetime import datetime

from ninja import Field, Schema

from api.schemas import BookOut, UserBrief


class PostIn(Schema):
    title: str = Field(max_length=140)
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


class Page(Schema):
    items: list[PostOut]
    total: int
    page: int
    has_next: bool
