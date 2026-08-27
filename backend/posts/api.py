from django.core.paginator import Paginator
from django.db.models import Max
from django.shortcuts import get_object_or_404
from ninja import File, PatchDict, Router, Status
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.security import django_auth

from books.models import Book
from core.images import compress_image
from posts.models import Post
from posts.schemas import Page, PostIn, PostOut

posts_router = Router()

MAX_IMAGES_PER_POST = 4
MAX_IMAGE_BYTES = 8 * 1024 * 1024

# PatchDict widens every field to optional; only book_id may actually be cleared.
NULLABLE_POST_FIELDS = {"book_id"}


def _own_post(request, post_id: int) -> Post:
    post = get_object_or_404(Post, pk=post_id)
    if post.author_id != request.user.id:
        raise HttpError(403, "Você não é o autor desta publicação.")
    return post


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
    _checked_book_id(payload.book_id)
    post = Post.objects.create(author=request.user, **payload.dict())
    return _with_relations(post)


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

    if post.images.count() >= MAX_IMAGES_PER_POST:
        raise HttpError(400, f"Uma publicação pode ter no máximo {MAX_IMAGES_PER_POST} imagens.")
    if file.size > MAX_IMAGE_BYTES:
        raise HttpError(400, "Arquivo maior que 8 MB.")

    next_position = (post.images.aggregate(m=Max("position"))["m"] or 0) + 1
    post.images.create(file=compress_image(file), position=next_position)
    return _with_relations(post)
