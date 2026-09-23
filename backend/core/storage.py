"""Where an upload lands in the bucket (ADR-11).

Media on R2 is public and unsigned: `querystring_auth=False` plus a `custom_domain`, so every
file answers forever at `https://<domain>/<key>`. That is deliberate — the year-long `immutable`
cache in `settings.py` needs a stable URL, and a signed one would defeat it — and it makes the
key the only thing standing between a member's photo and whoever guesses it.

So the key must not be guessable, and must never repeat. `upload_to="profiles/"` gave us neither:
it kept the uploader's filename, so a photo uploaded as `ana_souza.jpg` published
`/profiles/ana_souza.jpg`, and the name was free again the moment the file was deleted — the next
upload would reuse the key and a cache told to hold it for a year would serve the old image.
"""

import uuid

from django.utils import timezone
from django.utils.deconstruct import deconstructible


@deconstructible
class RandomKey:
    """`upload_to` that ignores the uploaded filename and returns `<prefix>/<uuid4>.jpg`.

    A class and not a closure or a lambda because `upload_to` is serialised into the migration,
    and `@deconstructible` is what lets Django write it back out as `RandomKey("profiles")`.

    The extension is always `.jpg` because `core.images.compress_image` re-encodes every upload
    as JPEG before it reaches a field — there is no other kind of file in the bucket.
    """

    def __init__(self, prefix: str):
        self.prefix = prefix

    def __call__(self, instance, filename: str) -> str:
        # `filename` is deliberately unused: it is the name the uploader chose, and keeping any
        # part of it is what made the old keys guessable.
        #
        # strftime on the prefix mirrors what Django does with a string `upload_to`, which is how
        # PostImage got its "posts/%Y/%m" partitioning. Prefixes without a format code come
        # through unchanged.
        prefix = timezone.localtime().strftime(self.prefix)
        return f"{prefix}/{uuid.uuid4().hex}.jpg"

    def __eq__(self, other):
        # Without this, makemigrations sees a new object every run and writes an AlterField that
        # changes nothing.
        return isinstance(other, RandomKey) and self.prefix == other.prefix
