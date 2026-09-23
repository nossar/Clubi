"""`manage.py seed_landing_carousel` — enough past picks to see the landing carousel move.

The local table holds two MonthlyPick rows, which is not enough to test rotation or the loop.
This fills the months before the earliest existing pick with real Brazilian titles and a mocked
cover for each, drawn here with Pillow — a coloured rectangle with the title on it — and saved
through the storage settings.py already configures for development, i.e. `backend/media/`. No
R2, no external host, no placeholder service: the page under test must load its covers from the
same origin it will be judged on.

Development-only, and it refuses to be anything else: it aborts outside DEBUG and it aborts when
R2_BUCKET is set, because the second is how production media is configured (ADR-11) and there is
a real database and a real bucket to protect now. Idempotent: it walks the last `--months` months
back from today, a month that already has a pick is left alone, a title that already exists is
reused, so running it twice adds nothing. `--clear` removes what it seeded and nothing else —
the seeded picks carry a blurb that names this command, and that is how they are found again.
"""

import calendar
import io
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont

from books.models import Book, MonthlyPick
from core.views import CURRENT_PICK_KEY, PICK_HISTORY_KEY

# Newest first: the first entry lands on the most recent month that has no pick yet.
TITLES = [
    ("Torto Arado", "Itamar Vieira Junior", 264),
    ("A Hora da Estrela", "Clarice Lispector", 88),
    ("Memórias Póstumas de Brás Cubas", "Machado de Assis", 208),
    ("O Cortiço", "Aluísio Azevedo", 240),
    ("Quarto de Despejo", "Carolina Maria de Jesus", 200),
    ("Capitães da Areia", "Jorge Amado", 280),
    ("Dom Casmurro", "Machado de Assis", 256),
    ("Iracema", "José de Alencar", 128),
    ("Macunaíma", "Mário de Andrade", 176),
    ("O Quinze", "Rachel de Queiroz", 160),
    ("O Alienista", "Machado de Assis", 96),
    ("A Paixão Segundo G.H.", "Clarice Lispector", 176),
]

# The brand palette (DESIGN.md 3.1) so the mock is judged against the real colours, cycling
# through the pairs the contrast table allows: never yellow on cream.
COVER_PALETTES = [
    ("#88013e", "#fdfae7"),  # wine, cream
    ("#fdfae7", "#88013e"),  # cream, wine
    ("#ed6630", "#290013"),  # orange, accent ink
    ("#ffd071", "#88013e"),  # yellow, wine
]

COVER_SIZE = (400, 600)
SEED_MARK = "dados de teste de seed_landing_carousel"

# The brand's own faces (DESIGN.md 4.1), read straight from core/static/brand/fonts/: FreeType
# opens woff2, and Pillow's bundled fallback has no glyphs for ç, í or ã — half these titles.
FONTS_DIR = Path(__file__).resolve().parents[2] / "static" / "brand" / "fonts"


def previous_month(day: date) -> date:
    first = day.replace(day=1)
    if first.month == 1:
        return first.replace(year=first.year - 1, month=12)
    return first.replace(month=first.month - 1)


def last_day_of_month(day: date) -> date:
    return day.replace(day=calendar.monthrange(day.year, day.month)[1])


def _font(name: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(str(FONTS_DIR / name), size)
    except OSError:
        return ImageFont.load_default(size=size)


def draw_cover(title: str, author: str, palette: tuple[str, str]) -> bytes:
    """A flat rectangle with the title, in the brand's colours. A mock, and it looks like one."""
    background, ink = palette
    image = Image.new("RGB", COVER_SIZE, background)
    draw = ImageDraw.Draw(image)
    title_font = _font("ClashDisplay-Semibold.woff2", 36)
    author_font = _font("Manrope-Regular.woff2", 22)

    margin = 32
    width = COVER_SIZE[0] - 2 * margin
    draw.rectangle(
        (margin // 2, margin // 2, COVER_SIZE[0] - margin // 2, COVER_SIZE[1] - margin // 2),
        outline=ink,
        width=3,
    )

    def wrap(text: str, font: ImageFont.FreeTypeFont) -> list[str]:
        lines: list[str] = []
        current = ""
        for word in text.split():
            candidate = f"{current} {word}".strip()
            if draw.textlength(candidate, font=font) <= width or not current:
                current = candidate
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines

    y = 120
    for line in wrap(title, title_font):
        draw.text((margin, y), line, fill=ink, font=title_font)
        y += 44
    y += 24
    for line in wrap(author, author_font):
        draw.text((margin, y), line, fill=ink, font=author_font)
        y += 30

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=82, optimize=True)
    return buffer.getvalue()


class Command(BaseCommand):
    help = "Fill the months before the earliest pick with mock picks and covers (DEBUG only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--months",
            type=int,
            default=6,
            help=f"How many past months to walk back from today (default 6, at most {len(TITLES)}).",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Remove the picks, books and covers a previous run created, instead of seeding.",
        )

    def handle(self, *args, **options):
        # Both guards are load-bearing; neither is a convenience. DEBUG is the dev switch, and
        # R2_BUCKET is what makes settings.STORAGES point at the production bucket (ADR-11) —
        # DEBUG=True with R2 configured is a legitimate local setup, and this command would
        # upload a dozen fake covers into the real store.
        if not settings.DEBUG:
            raise CommandError(
                "seed_landing_carousel só roda com DEBUG=True: este comando é para o banco local "
                "de desenvolvimento, nunca para o de produção."
            )
        if settings.R2_BUCKET:
            raise CommandError(
                "R2_BUCKET está definido: as capas falsas iriam para o bucket de verdade. "
                "Rode sem R2 (capas em backend/media/)."
            )

        if options["clear"]:
            created = -self.clear()
        else:
            created = self.seed(min(max(options["months"], 0), len(TITLES)))

        # The landing memoises both queries (core/views.py). LocMemCache is per process, so this
        # only clears the cache of *this* process — a runserver already up keeps its own for up to
        # CURRENT_PICK_TTL; say so rather than let someone conclude the seed did nothing.
        cache.delete_many([CURRENT_PICK_KEY, PICK_HISTORY_KEY])

        verb = "removido(s)" if created < 0 else "criado(s)"
        self.stdout.write(
            self.style.SUCCESS(f"{abs(created)} pick(s) {verb}.")
            + " Se o runserver já estava no ar, reinicie-o (ou espere 15 min) para o cache da "
            "landing esquecer a lista antiga."
        )

    def seed(self, months: int) -> int:
        """Walk back from last month, filling the gaps; returns how many picks were created."""
        month = previous_month(timezone.localdate())
        created = 0
        for _ in range(months):
            if not MonthlyPick.objects.filter(month=month).exists():
                title, author, pages = TITLES[created]
                book, _ = Book.objects.get_or_create(
                    title=title, author=author, defaults={"pages": pages, "synopsis": SEED_MARK}
                )
                # A reused book may point at a file the local media/ no longer has (a row
                # copied from elsewhere): a 404 on the page under test is what this command
                # exists to avoid, so the file has to be there, not just the name.
                if not book.cover or not book.cover.storage.exists(book.cover.name):
                    palette = COVER_PALETTES[created % len(COVER_PALETTES)]
                    # The name passed here is discarded: upload_to is core.storage.RandomKey,
                    # which returns covers/<uuid>.jpg (ADR-11). Nothing may key off it.
                    book.cover.save(
                        "mock.jpg",
                        ContentFile(draw_cover(title, author, palette)),
                        save=True,
                    )
                MonthlyPick.objects.create(
                    book=book,
                    month=month,
                    starts_on=month,
                    ends_on=last_day_of_month(month),
                    blurb=f"Leitura de {month:%m/%Y} — {SEED_MARK}.",
                )
                created += 1
                self.stdout.write(f"  + {month:%m/%Y}  {title} — {author}")
            month = previous_month(month)
        return created

    def clear(self) -> int:
        """Undo seed(): the marked picks, then the books nothing else uses.

        What makes a book ours is SEED_MARK in its synopsis, not the shape of its cover key —
        that key is a UUID since ADR-11 and carries no meaning at all.
        """
        picks = MonthlyPick.objects.filter(blurb__contains=SEED_MARK).select_related("book")
        books = {pick.book.pk: pick.book for pick in picks}
        removed, _ = picks.delete()
        for book in books.values():
            if book.picks.exists() or SEED_MARK not in book.synopsis:
                continue  # a real book, or one still picked: not ours to remove
            book.cover.delete(save=False)
            book.delete()
            self.stdout.write(f"  - {book.title} — {book.author}")
        return removed
