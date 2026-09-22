from datetime import date, datetime

from ninja import Field, Schema

from api.schemas import BookOut, UserBrief
from books.models import REVIEW_MAX_LENGTH


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
    # Zero is a rating — zero stars — and no longer doubles as "no rating", because a NOT NULL
    # `rating_halves` is one of the two things that puts a member on the "quem já terminou" list
    # and someone who meant to erase their note would otherwise stay on it. A null `rating` cannot mean "erase"
    # either: this is a partial PUT, so a request carrying only `pages_read` arrives with
    # `rating=None` and must leave the note alone. Hence a field of its own.
    clear_rating: bool = False
    # Bounded here and nowhere else that matters: the column is a TextField, so without this a
    # textarea the member can paste into is an unbounded write. An empty string is a real value
    # and it is the erasure — unlike the rating, whose 0 had to stop meaning "sem nota", "" is
    # unambiguously "no review", so no `clear_review` twin is needed.
    review: str | None = Field(default=None, max_length=REVIEW_MAX_LENGTH)
    # Finishing is a declaration, not an inference. Reaching the last page still marks the
    # reading finished, but `Book.pages` is nullable — for a pick without a page count that
    # inference can never fire, and before this field such a member could never finish, never
    # appear on "quem já terminou", and never be offered the review. `False` un-finishes, which
    # is the reversibility DESIGN.md 9 asks of everything on this row.
    finished: bool | None = None


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
    """One member who finished the current pick and left a note, a resenha, or both.

    It used to be `ReaderOut`, and it used to carry `pages_read`, `percent` and `finished_at`
    for a list of everyone with a reading row. The screen behind it now asks a narrower
    question — who closed the book, and what did they think — so the fields it stopped
    drawing left the contract with it rather than staying on as dead weight.

    `rating` **is** optional, and that is a correction rather than a widening. It used to be
    required because the route filtered every unrated row out — which also meant a member who
    wrote a resenha and left the stars alone was dropped from the list, taking their resenha
    with them. The route now asks for a finished reading with *something to say*, so a row can
    arrive with a review and no note.

    The review travels inline rather than behind a second request per member: this is one
    month's readers, tens of rows at most, and a fetch-on-expand would be N round trips to
    render a panel that is already only opened on purpose.
    """

    user: UserBrief
    rating: float | None
    review: str


# Read by users.schemas.UserProfileOut — the one cross-app schema import (ADR-15).
class ReadingHistoryOut(MonthlyReadingOut):
    """A past reading as it appears on a profile — it carries its own pick."""

    pick: MonthlyPickOut
