"""The bucket key must not carry the uploader's filename (ADR-11).

Media on R2 is public and unsigned, so the key is the only thing between a member's photo and
whoever guesses the URL. `upload_to="profiles/"` kept the original name, which published
`/profiles/ana_souza.jpg` — a member's full name in a permanent URL, and a key that came free
again the moment the file was deleted.
"""

import re

import pytest

from core.storage import RandomKey

KEY = re.compile(r"^profiles/[0-9a-f]{32}\.jpg$")


@pytest.mark.django_db
def test_upload_key_drops_the_original_filename(member, image_upload):
    member.photo = image_upload("ana_souza.jpg")
    member.save(update_fields=["photo"])

    assert KEY.match(member.photo.name), member.photo.name
    assert "ana_souza" not in member.photo.name


def test_two_uploads_of_the_same_filename_get_different_keys():
    """A repeated key would let a year of `immutable` caching serve the wrong image."""
    key = RandomKey("profiles")

    assert key(None, "foto.jpg") != key(None, "foto.jpg")


def test_prefix_keeps_its_date_partitioning():
    """PostImage's prefix carries strftime codes, the way a string `upload_to` would."""
    assert re.match(
        r"^posts/\d{4}/\d{2}/[0-9a-f]{32}\.jpg$", RandomKey("posts/%Y/%m")(None, "a.png")
    )


def test_deconstructs_for_the_migration():
    """A closure or a lambda here would not serialise, and the migration would not import."""
    path, args, kwargs = RandomKey("covers").deconstruct()

    assert (path, args, kwargs) == ("core.storage.RandomKey", ("covers",), {})
    assert RandomKey("covers") == RandomKey("covers")
