import requests
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError
from ninja.security import django_auth

from api.schemas import BookOut
from books.models import Book, MonthlyPick, MonthlyReading
from books.schemas import (
    BookIn,
    ExternalBookOut,
    FinishedReaderOut,
    MonthlyPickOut,
    MonthlyReadingIn,
    MonthlyReadingOut,
)

# Mounted at /api/books and /api/monthly-picks — both are books models.
books_router = Router()
picks_router = Router()

# Open Library needs no API key, which is why it is the default (guide, section 10 —
# swapping it for Google Books only changes _search_open_library).
OPEN_LIBRARY_URL = "https://openlibrary.org/search.json"
OPEN_LIBRARY_FIELDS = "key,title,author_name,first_publish_year,number_of_pages_median,cover_i"
OPEN_LIBRARY_TIMEOUT = 8


def _search_open_library(term: str, limit: int) -> list[dict]:
    try:
        response = requests.get(
            OPEN_LIBRARY_URL,
            params={"q": term, "limit": limit, "fields": OPEN_LIBRARY_FIELDS},
            timeout=OPEN_LIBRARY_TIMEOUT,
            headers={"User-Agent": "Clubi/1.0 (clube do livro da ESPM)"},
        )
        response.raise_for_status()
        docs = response.json().get("docs", [])
    except (requests.RequestException, ValueError) as exc:
        raise HttpError(502, "A busca externa de livros está indisponível.") from exc

    results = []
    for doc in docs:
        cover_id = doc.get("cover_i")
        results.append(
            {
                "external_id": (doc.get("key") or "").removeprefix("/works/"),
                "title": doc.get("title") or "",
                "author": ", ".join(doc.get("author_name") or []),
                "year": doc.get("first_publish_year"),
                "pages": doc.get("number_of_pages_median"),
                "cover_url": (
                    f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg" if cover_id else ""
                ),
            }
        )
    return results


def _current_pick() -> MonthlyPick:
    pick = MonthlyPick.current()
    if not pick:
        raise HttpError(404, "Não há livro do mês vigente.")
    return pick


@books_router.get("", response=list[BookOut])
def search_books(request, q: str = "", limit: int = 20):
    queryset = Book.objects.all()
    if q:
        queryset = queryset.filter(Q(title__icontains=q) | Q(author__icontains=q))
    return queryset[: max(1, min(limit, 50))]


@books_router.post("", response=BookOut, auth=django_auth)
def create_book(request, payload: BookIn):
    """Idempotent on (title, author): the same book coming twice from the
    autocomplete must not blow up on the unique constraint."""
    book, _ = Book.objects.get_or_create(
        title=payload.title,
        author=payload.author,
        defaults={
            "year": payload.year,
            "pages": payload.pages,
            "synopsis": payload.synopsis,
            "cover_url": payload.cover_url,
            "external_id": payload.external_id,
            "added_by": request.user,
        },
    )
    return book


@books_router.get("/external", response=list[ExternalBookOut], auth=django_auth)
def search_external_books(request, q: str, limit: int = 10):
    term = q.strip()
    if not term:
        raise HttpError(400, "Informe um termo de busca.")
    return _search_open_library(term, max(1, min(limit, 20)))


@books_router.get("/{int:book_id}", response=BookOut)
def read_book(request, book_id: int):
    return get_object_or_404(Book, pk=book_id)


@picks_router.get("", response=list[MonthlyPickOut])
def list_picks(request):
    return MonthlyPick.objects.select_related("book")


@picks_router.get("/current", response=MonthlyPickOut)
def current_pick(request):
    return _current_pick()


@picks_router.get("/current/readers", response=list[FinishedReaderOut])
def finished_readers(request):
    """Who has finished this month's book and left a rating.

    Both halves of the filter are load-bearing. `finished_at` is what makes this "quem já
    terminou" instead of "quem está lendo", and `rating_halves__isnull=False` is what gives
    every row something to say. **A rating of 0 keeps a member on this list**: zero stars is an
    opinion, and the only way a reading has no rating at all is for nobody to have written one
    — the column is `null=True` with no default, so it is born NULL and a 0 only ever arrives
    because someone sent one. Erasing a rating (`MonthlyReadingIn.clear_rating`) takes the row
    back off the list, which is the reversibility DESIGN.md 9 asks for.

    Ordered by name, not by when they finished or by how far they read: this is companionship,
    not a race (DESIGN.md 9). `pick__book` left the select_related along with `percent` — the
    only relation this response reads now is `user`, and that one is still the difference
    between one query and N.
    """
    return (
        _current_pick()
        .readings.filter(finished_at__isnull=False, rating_halves__isnull=False)
        .select_related("user")
        .order_by("user__full_name")
    )


@picks_router.get("/current/reading", response=MonthlyReadingOut, auth=django_auth)
def my_reading(request):
    reading, _ = MonthlyReading.objects.get_or_create(user=request.user, pick=_current_pick())
    return reading


@picks_router.put("/current/reading", response=MonthlyReadingOut, auth=django_auth)
def update_reading(request, payload: MonthlyReadingIn):
    pick = _current_pick()
    reading, _ = MonthlyReading.objects.get_or_create(user=request.user, pick=pick)

    if payload.pages_read is not None:
        total = pick.book.pages
        if total and payload.pages_read > total:
            raise HttpError(400, f"Este livro tem {total} páginas.")
        reading.pages_read = payload.pages_read
        if total and payload.pages_read >= total and not reading.finished_at:
            reading.finished_at = timezone.now()

    # Erasing and grading are two different requests, not one field doing both jobs — see the
    # comment on MonthlyReadingIn.clear_rating for why 0 stopped meaning "sem nota".
    if payload.clear_rating:
        if payload.rating is not None:
            raise HttpError(400, "Escolha entre dar uma nota e tirar a nota.")
        reading.rating = None
    elif payload.rating is not None:
        reading.rating = payload.rating

    if payload.review is not None:
        reading.review = payload.review

    reading.save()
    return reading
