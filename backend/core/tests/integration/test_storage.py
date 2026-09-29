"""The bucket key must not carry the uploader's filename (ADR-11).

Media on R2 is public and unsigned, so the key is the only thing between a member's photo and
whoever guesses the URL. `upload_to="profiles/"` kept the original name, which published
`/profiles/ana_souza.jpg` — a member's full name in a permanent URL, and a key that came free
again the moment the file was deleted.
"""

import re

import pytest

KEY = re.compile(r"^profiles/[0-9a-f]{32}\.jpg$")


@pytest.mark.django_db
def test_upload_key_drops_the_original_filename(member, image_upload):
    member.photo = image_upload("ana_souza.jpg")
    member.save(update_fields=["photo"])

    assert KEY.match(member.photo.name), member.photo.name
    assert "ana_souza" not in member.photo.name
