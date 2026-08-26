import io

from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image


def compress_image(uploaded_file, max_width: int = 1600, quality: int = 82):
    """Resize and re-encode an upload as JPEG to keep storage and bandwidth low."""
    image = Image.open(uploaded_file).convert("RGB")

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
