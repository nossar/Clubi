from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


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
    rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
    )
    review = models.TextField(blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-pick__month"]
        constraints = [
            models.UniqueConstraint(fields=["user", "pick"], name="one_reading_per_pick")
        ]

    def __str__(self):
        return f"{self.user} — {self.pick}"

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
