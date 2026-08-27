from datetime import date, datetime

from ninja import Field, Schema

from api.schemas import BookOut, UserBrief


class BookIn(Schema):
    title: str = Field(max_length=200)
    author: str = Field(max_length=140)
    year: int | None = Field(default=None, ge=0, le=2200)
    pages: int | None = Field(default=None, ge=1)
    synopsis: str = ""
    cover_url: str = ""
    external_id: str = ""


class ExternalBookOut(Schema):
    """A hit from the external catalogue, shaped so it can be POSTed back as a BookIn."""

    external_id: str
    title: str
    author: str
    year: int | None
    pages: int | None
    cover_url: str


class MonthlyReadingIn(Schema):
    pages_read: int | None = Field(default=None, ge=0)
    rating: int | None = Field(default=None, ge=0, le=5)
    review: str | None = None


class MonthlyReadingOut(Schema):
    pages_read: int
    percent: int | None
    rating: int | None
    review: str
    finished_at: datetime | None
    updated_at: datetime


class MonthlyPickOut(Schema):
    id: int
    month: date
    starts_on: date
    ends_on: date
    blurb: str
    book: BookOut


# Lives here, not in users: this is the return type of
# GET /api/monthly-picks/current/readers, and the pick is a books model. It embeds
# the UserBrief projection rather than importing users.schemas — that import is
# what would make books and users circular (ADR-15).
class ReaderOut(Schema):
    """One member's position in the current pick, for the "who is reading" list."""

    user: UserBrief
    pages_read: int
    percent: int | None
    finished_at: datetime | None


# Read by users.schemas.UserProfileOut — the one cross-app schema import (ADR-15).
class ReadingHistoryOut(MonthlyReadingOut):
    """A past reading as it appears on a profile — it carries its own pick."""

    pick: MonthlyPickOut
