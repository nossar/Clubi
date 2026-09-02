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
    # Half stars, in the units a member sees: 0 to 5 in steps of 0.5. `multiple_of` is what
    # turns a 5.3 into a 422 instead of a rounded write. The column behind this holds twice the
    # number (books.models.MonthlyReading.rating_halves), and that is deliberately invisible
    # here — the contract is stars, not storage.
    rating: float | None = Field(default=None, ge=0, le=5, multiple_of=0.5)
    # Zero is a rating — zero stars — and no longer doubles as "no rating", because the
    # "quem já terminou" list is filtered on `rating_halves` being NOT NULL and a member who
    # meant to erase their note would otherwise stay on it. A null `rating` cannot mean "erase"
    # either: this is a partial PUT, so a request carrying only `pages_read` arrives with
    # `rating=None` and must leave the note alone. Hence a field of its own.
    clear_rating: bool = False
    review: str | None = None


class MonthlyReadingOut(Schema):
    pages_read: int
    percent: int | None
    # Resolved from the model's `rating` property, so the halving happens once, in the model,
    # for every reader — not in a computed field only the API would benefit from.
    rating: float | None
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
class FinishedReaderOut(Schema):
    """One member who finished the current pick and rated it.

    It used to be `ReaderOut`, and it used to carry `pages_read`, `percent` and `finished_at`
    for a list of everyone with a reading row. The screen behind it now asks a narrower
    question — who closed the book, and what did they think — so the fields it stopped
    drawing left the contract with it rather than staying on as dead weight.

    `rating` is not optional even though the column is: the route filters rows without one
    out, so a null can never reach this schema.
    """

    user: UserBrief
    rating: float


# Read by users.schemas.UserProfileOut — the one cross-app schema import (ADR-15).
class ReadingHistoryOut(MonthlyReadingOut):
    """A past reading as it appears on a profile — it carries its own pick."""

    pick: MonthlyPickOut
