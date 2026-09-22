import io

from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image, ImageOps


def compress_image(uploaded_file, max_width: int = 1600, quality: int = 82):
    """Resize and re-encode an upload as JPEG to keep storage and bandwidth low."""
    image = Image.open(uploaded_file)

    # A phone photographs in one orientation and stores another: the sensor writes its pixels
    # the way it always does and records the rotation in an EXIF tag, which browsers honour.
    # Re-encoding here drops that tag, so the rotation has to be baked into the pixels first —
    # without this line a portrait taken on a phone arrives sideways or upside down.
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB")

    if image.width > max_width:
        height = round(image.height * max_width / image.width)
        image = image.resize((max_width, height), Image.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True)
    buffer.seek(0)

    name = uploaded_file.name.rsplit(".", 1)[0] + ".jpg"
    return InMemoryUploadedFile(
        buffer, "ImageField", name, "image/jpeg", buffer.getbuffer().nbytes, None
    )
