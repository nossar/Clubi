from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

MAX_RATING = 5
# One unit of MonthlyReading.rating_halves is half a star (ADR-06 keeps the column an integer).
HALVES_PER_STAR = 2


class Book(models.Model):
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=140)
    year = models.PositiveSmallIntegerField(null=True, blank=True)
    pages = models.PositiveIntegerField(null=True, blank=True)
    synopsis = models.TextField(blank=True)
    cover = models.ImageField(upload_to="covers/", null=True, blank=True)
    cover_url = models.URLField(blank=True)  # when it came from an external API
    external_id = models.CharField(max_length=60, blank=True, db_index=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(fields=["title", "author"], name="unique_book_title_author")
        ]

    def __str__(self):
        return f"{self.title} — {self.author}"

    @property
    def cover_image(self) -> str:
        """Cover URL, whether uploaded or taken from an external API."""
        return self.cover.url if self.cover else self.cover_url


class MonthlyPick(models.Model):
    """The club's book of the month. One row per month."""

    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name="picks")
    month = models.DateField(unique=True, help_text="Always the 1st day of the month")
    starts_on = models.DateField()
    ends_on = models.DateField()
    blurb = models.TextField(blank=True)
    discussion_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-month"]
        verbose_name = "Monthly pick"

    def __str__(self):
        return f"{self.month:%m/%Y} — {self.book.title}"

    def clean(self):
        if self.starts_on and self.ends_on and self.starts_on > self.ends_on:
            raise ValidationError("Start date cannot be after end date.")
        if self.month and self.month.day != 1:
            raise ValidationError("Use the 1st day of the month.")

    @classmethod
    def current(cls) -> "MonthlyPick | None":
        today = timezone.localdate()
        return (
            cls.objects.filter(starts_on__lte=today, ends_on__gte=today)
            .select_related("book")
            .first()
        )


class MonthlyReading(models.Model):
    """A member's reading of a monthly pick: progress, rating and review.

    This is also the profile history — every past reading is one row.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="monthly_readings"
    )
    pick = models.ForeignKey(MonthlyPick, on_delete=models.CASCADE, related_name="readings")
    pages_read = models.PositiveIntegerField(default=0)
    # Stored in half-stars, so a member's 3.5 is a 7 in this column: it keeps the field an
    # integer (no float rounding on a value that is compared and displayed) while allowing the
    # half steps the stars draw. Base 10 is an implementation detail of this column and of
    # nothing else — read and write it through the `rating` property below, which is the one
    # place the doubling happens and the reason the API never sees a 7.
    rating_halves = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(HALVES_PER_STAR * MAX_RATING)],
        help_text="Half-stars: 7 means 3.5 stars. Use MonthlyReading.rating to read or write it.",
    )
    review = models.TextField(blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-pick__month"]
        constraints = [
            models.UniqueConstraint(fields=["user", "pick"], name="one_reading_per_pick"),
            # The validators above only run on full_clean, which the API never calls; this is
            # what actually holds the column to the 0–5 star range. A NULL passes, as it must —
            # a reading with no rating is the normal case.
            models.CheckConstraint(
                condition=models.Q(
                    rating_halves__gte=0,
                    rating_halves__lte=HALVES_PER_STAR * MAX_RATING,
                ),
                name="rating_between_0_and_10_halves",
            ),
        ]

    def __str__(self):
        return f"{self.user} — {self.pick}"

    @property
    def rating(self) -> float | None:
        """The rating as the club talks about it: 0 to 5 in steps of 0.5, or None for no rating.

        This property, not the schema, is where base 10 is undone. A computed field on
        `MonthlyReadingOut` would have converted for the API and left every other reader —
        the admin, a shell session, a future template, an aggregate — holding a 7 and having
        to remember to halve it. Here the ORM object itself speaks the domain's units, and
        both the schema and the admin get the right number by plain attribute access.
        """
        if self.rating_halves is None:
            return None
        return self.rating_halves / HALVES_PER_STAR

    @rating.setter
    def rating(self, value: float | None) -> None:
        if value is None:
            self.rating_halves = None
            return
        halves = value * HALVES_PER_STAR
        if halves != int(halves):
            raise ValidationError("A rating must be a multiple of 0.5.")
        if not 0 <= halves <= HALVES_PER_STAR * MAX_RATING:
            raise ValidationError(f"A rating must be between 0 and {MAX_RATING}.")
        self.rating_halves = int(halves)

    @property
    def percent(self) -> int | None:
        total = self.pick.book.pages
        if not total:
            return None
        return min(100, self.pages_read * 100 // total)


class Favorite(models.Model):
    """One slot on a member's four-book shelf."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    position = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="no_duplicate_favorite"),
            models.UniqueConstraint(fields=["user", "position"], name="one_book_per_slot"),
            models.CheckConstraint(
                condition=models.Q(position__gte=1, position__lte=4),
                name="favorite_position_between_1_and_4",
            ),
        ]

    def __str__(self):
        return f"{self.user} #{self.position} — {self.book.title}"
