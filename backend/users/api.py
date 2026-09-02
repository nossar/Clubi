from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from ninja import File, PatchDict, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile

from api.schemas import BookOut, UserBrief
from books.models import Book, Favorite
from core.images import compress_image
from users.models import User
from users.schemas import FavoritesIn, MeOut, ProfileIn, UserProfileOut

# Mounted at /api/me, authenticated as a whole (see api/api.py).
me_router = Router()

# Mounted at /api/users — public.
users_router = Router()

MAX_PHOTO_BYTES = 8 * 1024 * 1024

# PatchDict widens every field to optional, so a client can send an explicit null
# for a field the model stores as a blank string. Only birth_date is really nullable.
NULLABLE_PROFILE_FIELDS = {"birth_date"}


def _shelf(user: User) -> list[Book]:
    return [f.book for f in Favorite.objects.filter(user=user).select_related("book")]


@me_router.get("", response=MeOut)
def read_me(request):
    """The SPA's login signal: 401 here means "send the visitor to /accounts/login/"."""
    return request.user


@me_router.patch("", response=MeOut)
def update_me(request, payload: PatchDict[ProfileIn]):
    user = request.user

    for field, value in payload.items():
        if value is None and field not in NULLABLE_PROFILE_FIELDS:
            value = ""
        setattr(user, field, value)

    if payload:
        user.save(update_fields=list(payload))
    return user


@me_router.put("/photo", response=MeOut)
def upload_photo(request, file: File[UploadedFile]):
    if file.size > MAX_PHOTO_BYTES:
        raise HttpError(400, "Arquivo maior que 8 MB.")

    request.user.photo = compress_image(file)
    request.user.save(update_fields=["photo"])
    return request.user


@me_router.get("/favorites", response=list[BookOut])
def list_favorites(request):
    return _shelf(request.user)


@me_router.put("/favorites", response=list[BookOut])
def save_favorites(request, payload: FavoritesIn):
    positions = [f.position for f in payload.favorites]
    if len(set(positions)) != len(positions):
        raise HttpError(400, "Posições repetidas.")

    book_ids = [f.book_id for f in payload.favorites]
    if len(set(book_ids)) != len(book_ids):
        raise HttpError(400, "O mesmo livro aparece duas vezes na estante.")
    if Book.objects.filter(id__in=book_ids).count() != len(book_ids):
        raise HttpError(400, "Algum dos livros não existe.")

    with transaction.atomic():
        Favorite.objects.filter(user=request.user).delete()
        Favorite.objects.bulk_create(
            [
                Favorite(user=request.user, book_id=f.book_id, position=f.position)
                for f in payload.favorites
            ]
        )

    return _shelf(request.user)


@users_router.get("", response=list[UserBrief])
def search_users(request, q: str = "", limit: int = 20):
    queryset = User.objects.filter(is_active=True)
    if q:
        queryset = queryset.filter(Q(full_name__icontains=q) | Q(username__icontains=q))
    return queryset[: max(1, min(limit, 50))]


@users_router.get("/{username}", response=UserProfileOut)
def read_profile(request, username: str):
    return get_object_or_404(User, username=username, is_active=True)
