from datetime import date

from ninja import Field, Schema

from api.schemas import BookOut, UserBrief
from books.models import Favorite
from books.schemas import ReadingHistoryOut


class ProfileIn(Schema):
    """Only ever used through PatchDict — every field is optional on the wire."""

    full_name: str = Field(default="", max_length=120)
    quote: str = Field(default="", max_length=180)
    birth_date: date | None = None


class FavoriteIn(Schema):
    book_id: int
    position: int = Field(ge=1, le=4)


class FavoritesIn(Schema):
    favorites: list[FavoriteIn] = Field(max_length=4)


class UserOut(UserBrief):
    quote: str
    birth_date: date | None
    favorites: list[BookOut]

    @staticmethod
    def resolve_favorites(obj):
        # Not obj.favorites: the M2M orders by Book.Meta, not by the shelf slot.
        return [f.book for f in Favorite.objects.filter(user=obj).select_related("book")]


class UserProfileOut(UserOut):
    readings: list[ReadingHistoryOut]

    @staticmethod
    def resolve_readings(obj):
        return obj.monthly_readings.select_related("pick__book")
