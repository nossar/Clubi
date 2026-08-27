"""Fixtures shared by the per-app API test modules.

API tests live with their app (books/test_api.py, users/test_api.py, …), so the
fixtures they have in common — a member, a book, an active pick — are hoisted
here rather than duplicated four times.
"""

import io
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from books.models import Book, MonthlyPick
from users.models import User

PASSWORD = "livro-do-mes-2026"


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    """Keep uploads out of backend/media/ while the suite runs."""
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


@pytest.fixture
def member():
    return User.objects.create_user(
        username="ana", email="ana@espm.br", password=PASSWORD, full_name="Ana Ribeiro"
    )


@pytest.fixture
def other():
    return User.objects.create_user(
        username="bruno", email="bruno@espm.br", password=PASSWORD, full_name="Bruno Alves"
    )


@pytest.fixture
def auth(client, member):
    client.force_login(member)
    return client


@pytest.fixture
def book():
    return Book.objects.create(
        title="Grande Sertão: Veredas", author="João Guimarães Rosa", pages=600
    )


@pytest.fixture
def pick(book):
    today = timezone.localdate()
    return MonthlyPick.objects.create(
        book=book,
        month=today.replace(day=1),
        starts_on=today - timedelta(days=5),
        ends_on=today + timedelta(days=20),
        blurb="O sertão é do tamanho do mundo.",
    )


@pytest.fixture
def image_upload():
    """Factory for a real PNG upload — compress_image needs bytes Pillow can open."""

    def make(name="capa.png", size=(20, 20)):
        buffer = io.BytesIO()
        Image.new("RGB", size, "darkred").save(buffer, format="PNG")
        return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")

    return make
