from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import File, PatchDict, Router, Status
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.security import django_auth

from books.models import Book
from core.images import compress_image
from posts.models import Post
from posts.schemas import Page, PostIn, PostOut, UnreadPostsOut

posts_router = Router()

MAX_IMAGES_PER_POST = 4
MAX_IMAGE_BYTES = 8 * 1024 * 1024

# PatchDict widens every field to optional; only book_id may actually be cleared.
NULLABLE_POST_FIELDS = {"book_id"}


def _staff_only(request) -> None:
    """Writing is the club's own voice, so only the organisers do it.

    The backend is the authority here and the SPA merely echoes it: `MeOut.is_staff` is what
    hides the "Postar" shortcuts, but hiding a button is decoration — this is the check.
    """
    if not request.user.is_staff:
        raise HttpError(403, "Só a organização do clubi escreve postagens.")


def _own_post(request, post_id: int) -> Post:
    _staff_only(request)
    post = get_object_or_404(Post, pk=post_id)
    if post.author_id != request.user.id:
        raise HttpError(403, "Você não é o autor desta postagem.")
    return post


def _unread(user) -> QuerySet[Post]:
    """The published postagens this member has not seen yet.

    Their own never count — you do not need to be told about what you just wrote. A NULL
    `posts_seen_at` means the member has never opened the feed, so everything counts; that is
    what every member gets the first time this runs, and one visit to /posts settles it.
    """
    queryset = Post.objects.filter(published=True).exclude(author=user)
    if user.posts_seen_at:
        queryset = queryset.filter(created_at__gt=user.posts_seen_at)
    return queryset


def _checked_book_id(book_id: int | None) -> int | None:
    if book_id is not None and not Book.objects.filter(pk=book_id).exists():
        raise HttpError(400, "O livro informado não existe.")
    return book_id


def _with_relations(post: Post) -> Post:
    return Post.objects.select_related("author", "book").prefetch_related("images").get(pk=post.pk)


@posts_router.get("", response=Page)
def list_posts(request, page: int = 1, size: int = 10):
    queryset = (
        Post.objects.filter(published=True)
        .select_related("author", "book")
        .prefetch_related("images")
    )
    paginator = Paginator(queryset, max(1, min(size, 50)))
    current = paginator.get_page(page)
    return {
        "items": list(current),
        "total": paginator.count,
        "page": current.number,
        "has_next": current.has_next(),
    }


@posts_router.post("", response=PostOut, auth=django_auth)
def create_post(request, payload: PostIn):
    _staff_only(request)
    _checked_book_id(payload.book_id)
    post = Post.objects.create(author=request.user, **payload.dict())
    return _with_relations(post)


# Feed-level, so they sit above the /{post_id} routes. The `int:` converter is what keeps
# /posts/unread from ever being read as a post id, whatever the registration order.
@posts_router.get("/unread", response=UnreadPostsOut, auth=django_auth)
def unread_posts(request):
    """The number behind the badge on the balão in the header."""
    return {"count": _unread(request.user).count()}


@posts_router.post("/seen", response=UnreadPostsOut, auth=django_auth)
def mark_posts_seen(request):
    """Opening the feed is what marks the postagens as read — there is no per-post state.

    One stamp on the member, not a row per post: what the badge has to answer is "is there
    anything new since you last looked", and a timestamp answers exactly that. Per-post read
    receipts would be a table that grows with members × postagens to tell us nothing more.
    """
    request.user.posts_seen_at = timezone.now()
    request.user.save(update_fields=["posts_seen_at"])
    return {"count": 0}


@posts_router.get("/{int:post_id}", response=PostOut)
def read_post(request, post_id: int):
    queryset = Post.objects.select_related("author", "book").prefetch_related("images")
    return get_object_or_404(queryset, pk=post_id, published=True)


@posts_router.patch("/{int:post_id}", response=PostOut, auth=django_auth)
def update_post(request, post_id: int, payload: PatchDict[PostIn]):
    post = _own_post(request, post_id)

    if "book_id" in payload:
        _checked_book_id(payload["book_id"])

    changed = [
        field
        for field, value in payload.items()
        if value is not None or field in NULLABLE_POST_FIELDS
    ]
    for field in changed:
        setattr(post, field, payload[field])

    if changed:
        post.save(update_fields=[*changed, "updated_at"])
    return _with_relations(post)


@posts_router.delete("/{int:post_id}", response={204: None}, auth=django_auth)
def delete_post(request, post_id: int):
    _own_post(request, post_id).delete()
    return Status(204, None)


@posts_router.post("/{int:post_id}/images", response=PostOut, auth=django_auth)
def attach_image(request, post_id: int, file: File[UploadedFile]):
    post = _own_post(request, post_id)

    if file.size > MAX_IMAGE_BYTES:
        raise HttpError(400, "Arquivo maior que 8 MB.")

    # The smallest free slot, not max(position) + 1: deleting an image through the
    # admin inline leaves a hole, and counting the rows would still say there is
    # room while the next position was already past the 1-4 CheckConstraint.
    taken = set(post.images.values_list("position", flat=True))
    free = [slot for slot in range(1, MAX_IMAGES_PER_POST + 1) if slot not in taken]
    if not free:
        raise HttpError(400, f"Uma postagem pode ter no máximo {MAX_IMAGES_PER_POST} imagens.")

    image = compress_image(file)
    try:
        # atomic() opens a savepoint so the IntegrityError can be caught without
        # poisoning the surrounding transaction.
        with transaction.atomic():
            post.images.create(file=image, position=free[0])
    except IntegrityError as exc:
        # A concurrent upload committed that slot between the read above and this
        # insert. The unique constraint is the arbiter; the loser retries.
        raise HttpError(409, "Outra imagem ocupou esse espaço. Tente novamente.") from exc

    return _with_relations(post)
