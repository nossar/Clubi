"""`compress_image` is the one door every upload goes through — a profile photo and a postagem's
image both land here — so the orientation regression is worth pinning at this level rather than
twice at the API level.

A phone does not rotate its pixels. It writes them the way the sensor reads them and records the
rotation it was held at in EXIF tag 274, which every browser applies on the way to the screen.
Re-encoding to JPEG here throws that tag away, so a portrait uploaded from a phone came back
sideways until the transpose was baked into the pixels.
"""

import io

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from core.images import compress_image


def oriented_upload(orientation: int, size=(40, 20)):
    """A JPEG that claims, in EXIF, to have been shot at the given orientation."""
    image = Image.new("RGB", size, "darkred")
    exif = image.getexif()
    exif[274] = orientation

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return SimpleUploadedFile("foto.jpg", buffer.getvalue(), content_type="image/jpeg")


def test_rotates_a_photo_the_phone_only_tagged():
    """Orientation 6 is a portrait held with the home button to the right: the stored pixels are
    landscape and the viewer turns them a quarter. 40x20 in must come out 20x40."""
    result = compress_image(oriented_upload(6))

    assert Image.open(result).size == (20, 40)


def test_leaves_an_upright_photo_alone():
    result = compress_image(oriented_upload(1))

    assert Image.open(result).size == (40, 20)


def test_keeps_working_on_a_file_with_no_exif_at_all():
    """A PNG has no orientation tag to read, and screenshots and scans arrive this way."""
    buffer = io.BytesIO()
    Image.new("RGB", (30, 10), "darkred").save(buffer, format="PNG")
    upload = SimpleUploadedFile("capa.png", buffer.getvalue(), content_type="image/png")

    assert Image.open(compress_image(upload)).size == (30, 10)
