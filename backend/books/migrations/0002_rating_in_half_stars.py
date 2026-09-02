# Ratings move from whole stars (0-5) to half-stars (0-10), so 3.5 can be stored in an integer
# column. The three operations have to stay in this order: rename first so the doubling writes to
# the new name, double the existing rows while the old 0-5 range is still the only thing bounding
# them, and add the 0-10 check last — added first, it would be a constraint the pre-migration data
# satisfies and the post-migration data is checked against on the way in.
import django.core.validators
from django.db import migrations, models
from django.db.models import F


def to_half_stars(apps, schema_editor):
    MonthlyReading = apps.get_model("books", "MonthlyReading")
    MonthlyReading.objects.filter(rating_halves__isnull=False).update(
        rating_halves=F("rating_halves") * 2
    )


def to_whole_stars(apps, schema_editor):
    """Reverse: 7 would round to 3, so a half-star given after this migration is lost going back.

    Nothing else can happen — the old column cannot hold it — and the loss is confined to the
    half, never to the reading itself.
    """
    MonthlyReading = apps.get_model("books", "MonthlyReading")
    MonthlyReading.objects.filter(rating_halves__isnull=False).update(
        rating_halves=F("rating_halves") / 2
    )


class Migration(migrations.Migration):
    dependencies = [
        ("books", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="monthlyreading",
            old_name="rating",
            new_name="rating_halves",
        ),
        migrations.RunPython(to_half_stars, to_whole_stars),
        migrations.AlterField(
            model_name="monthlyreading",
            name="rating_halves",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text=(
                    "Half-stars: 7 means 3.5 stars. "
                    "Use MonthlyReading.rating to read or write it."
                ),
                null=True,
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(10),
                ],
            ),
        ),
        migrations.AddConstraint(
            model_name="monthlyreading",
            constraint=models.CheckConstraint(
                condition=models.Q(rating_halves__gte=0, rating_halves__lte=10),
                name="rating_between_0_and_10_halves",
            ),
        ),
    ]
